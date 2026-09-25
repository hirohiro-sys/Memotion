import {
  type CreateMemoRequest,
  type Memo,
  memoListResponseSchema,
  memoSchema,
} from "@repo/shared";
import { nanoid } from "nanoid";
import { createDb, type Database } from "../../db";
import type { Env } from "../../env";
import { fetchMessageContent } from "../../lib/line/client";
import type { ClassifySuccess } from "./classify";
import { detectMediaType } from "./classify";
import { fetchOgpImage, isHttpsUrl } from "./ogp";
import {
  claimOgp,
  deleteMedia,
  deleteMemoById,
  findByLineMessageId,
  findMemoMedia,
  findTagBySlug,
  getMedia,
  insertMemo,
  isUniqueConstraintError,
  listClaimableOgpIds,
  listMemos,
  type MemoRow,
  memoImageKey,
  type OgpState,
  type OgpTarget,
  putMedia,
  updateMemoOgp,
} from "./repository";

const OGP_CLAIM_STALE_MS = 30_000;
const OGP_BACKFILL_BUDGET_MS = 20_000;

export type PersistResult =
  | { status: "inserted" }
  | { status: "duplicate" }
  | { status: "failed"; reason: "save_failed" };

export function toMemoResponse(row: MemoRow): Memo {
  return memoSchema.parse({
    id: row.id,
    tag: row.tag,
    content: row.content,
    mediaType: row.mediaType,
    source: row.source,
    createdAt: row.createdAt,
    ...(row.url ? { url: row.url } : {}),
    ...(row.mediaType === "image" || (row.mediaType === "url" && row.imageKey)
      ? { thumbnailUrl: `/api/memos/${row.id}/image` }
      : {}),
  });
}

export async function listForUser(db: Database, userId: string) {
  const rows = await listMemos(db, userId);
  return memoListResponseSchema.parse({ items: rows.map(toMemoResponse) });
}

export async function createForUser(
  db: Database,
  userId: string,
  input: CreateMemoRequest,
): Promise<
  { ok: true; memo: Memo } | { ok: false; error: "invalid" | "save_failed" }
> {
  const tag = await findTagBySlug(db, input.tag);
  if (!tag) return { ok: false, error: "invalid" };

  const memoId = nanoid();
  const createdAt = new Date().toISOString();
  const mediaType = detectMediaType(input.content);

  try {
    await insertMemo(db, {
      id: memoId,
      userId,
      tagId: tag.id,
      content: input.content,
      url: null,
      imageKey: null,
      source: "web",
      mediaType,
      lineMessageId: null,
      createdAt,
    });
  } catch {
    return { ok: false, error: "save_failed" };
  }

  return {
    ok: true,
    memo: toMemoResponse({
      id: memoId,
      tag: tag.slug,
      content: input.content,
      url: null,
      imageKey: null,
      mediaType,
      source: "web",
      createdAt,
    }),
  };
}

export async function getImageForUser(
  env: Pick<Env, "DB" | "MEDIA">,
  userId: string,
  memoId: string,
) {
  const db = createDb(env.DB);
  const row = await findMemoMedia(db, memoId);
  if (!row || row.userId !== userId || !row.imageKey) {
    return null;
  }
  return getMedia(env.MEDIA, row.imageKey);
}

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

async function captureOgpImage(
  env: Pick<Env, "DB" | "MEDIA">,
  memo: OgpTarget,
): Promise<Exclude<OgpState, "pending">> {
  const db = createDb(env.DB);

  if (!isHttpsUrl(memo.content)) {
    await updateMemoOgp(db, memo.id, { ogpState: "skipped" });
    return "skipped";
  }

  const image = await fetchOgpImage(memo.content);
  if (!image) {
    await updateMemoOgp(db, memo.id, { ogpState: "failed" });
    logJson({ event: "memo.ogp", status: "failed", memoId: memo.id });
    return "failed";
  }

  const imageKey = memoImageKey(memo.userId, memo.id);
  await putMedia(env.MEDIA, imageKey, image.body, image.contentType);
  await updateMemoOgp(db, memo.id, { ogpState: "ready", imageKey });
  return "ready";
}

function ogpStaleBefore(now: number): string {
  return new Date(now - OGP_CLAIM_STALE_MS).toISOString();
}

export async function captureOgpForMemo(
  env: Pick<Env, "DB" | "MEDIA">,
  memoId: string,
): Promise<void> {
  try {
    const now = Date.now();
    const target = await claimOgp(
      createDb(env.DB),
      memoId,
      new Date(now).toISOString(),
      ogpStaleBefore(now),
    );
    if (target) await captureOgpImage(env, target);
  } catch {
    logJson({ event: "memo.ogp", status: "error", memoId });
  }
}

export async function backfillOgpForUser(
  env: Pick<Env, "DB" | "MEDIA">,
  userId: string,
): Promise<void> {
  const startedAt = Date.now();
  try {
    const ids = await listClaimableOgpIds(
      createDb(env.DB),
      userId,
      ogpStaleBefore(startedAt),
    );
    for (const id of ids) {
      if (Date.now() - startedAt > OGP_BACKFILL_BUDGET_MS) return;
      await captureOgpForMemo(env, id);
    }
  } catch {
    logJson({ event: "memo.ogp.backfill", status: "error" });
  }
}

export async function deleteForUser(
  env: Pick<Env, "DB" | "MEDIA">,
  userId: string,
  memoId: string,
): Promise<"deleted" | "not_found"> {
  const db = createDb(env.DB);
  const row = await findMemoMedia(db, memoId);
  if (!row || row.userId !== userId) {
    return "not_found";
  }

  await deleteMemoById(db, memoId);

  if (row.imageKey) {
    try {
      await deleteMedia(env.MEDIA, row.imageKey);
    } catch {
      logJson({
        event: "memo.image.delete",
        status: "failed",
        imageKey: row.imageKey,
      });
    }
  }

  return "deleted";
}

export async function createFromLine(
  env: Pick<Env, "DB" | "MEDIA" | "LINE_CHANNEL_ACCESS_TOKEN">,
  input: {
    userId: string;
    lineMessageId: string;
    classified: ClassifySuccess;
  },
): Promise<PersistResult> {
  try {
    const db = createDb(env.DB);
    const existing = await findByLineMessageId(db, input.lineMessageId);
    if (existing) return { status: "duplicate" };

    const tag = await findTagBySlug(db, input.classified.tag);
    if (!tag) return { status: "failed", reason: "save_failed" };

    const memoId = nanoid();
    let imageKey: string | null = null;

    if (input.classified.mediaType === "image") {
      const content = await fetchMessageContent({
        accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
        messageId: input.lineMessageId,
      });
      if (!content) return { status: "failed", reason: "save_failed" };

      imageKey = memoImageKey(input.userId, memoId);
      await putMedia(env.MEDIA, imageKey, content.body, content.contentType);
    }

    await insertMemo(db, {
      id: memoId,
      userId: input.userId,
      tagId: tag.id,
      content: input.classified.content,
      url: null,
      imageKey,
      source: "line",
      mediaType: input.classified.mediaType,
      lineMessageId: input.lineMessageId,
      createdAt: new Date().toISOString(),
    });
    if (input.classified.mediaType === "url") {
      await captureOgpForMemo(env, memoId);
    }
    return { status: "inserted" };
  } catch (error) {
    if (isUniqueConstraintError(error)) return { status: "duplicate" };
    return { status: "failed", reason: "save_failed" };
  }
}
