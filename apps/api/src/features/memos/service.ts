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
import { isForeignKeyViolation } from "./constraint-error";
import {
  decideCreateResult,
  type ExistingMemoRow,
  isPrimaryKeyConflict,
  type SaveResult,
} from "./idempotency";
import { fetchOgpImage, isHttpsUrl } from "./ogp";
import {
  assignMemosToGroup,
  claimOgp,
  countMemosByGroup,
  deleteMedia,
  deleteMemosByIds,
  deleteMemosInGroupStatement,
  findByLineMessageId,
  findMemoMedia,
  findMemoWithOwner,
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
import { resolveCreatedAt } from "./resolve-created-at";

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

// 既定ではどのグループにも入っていないメモだけを返す。groupId を渡すとそのグループのメモだけを返す。
// groupId の持ち主の確認は呼び出し側（groups の service）が行う。
export async function listForUser(
  db: Database,
  userId: string,
  options: { groupId?: string } = {},
) {
  const rows = await listMemos(db, userId, options.groupId ?? null);
  return memoListResponseSchema.parse({ items: rows.map(toMemoResponse) });
}

export async function createForUser(
  db: Database,
  userId: string,
  input: CreateMemoRequest,
  options: { groupId?: string } = {},
): Promise<
  | { ok: true; memo: Memo; created: boolean }
  | {
      ok: false;
      error: "invalid" | "save_failed" | "conflict" | "group_missing";
    }
> {
  const { groupId } = options;
  const tag = await findTagBySlug(db, input.tag);
  if (!tag) return { ok: false, error: "invalid" };

  const memoId = input.id ?? nanoid();
  const createdAt = resolveCreatedAt(input.createdAt, new Date());
  const mediaType = detectMediaType(input.content);

  let saveResult: SaveResult = "inserted";
  let existing: ExistingMemoRow | null = null;
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
      groupId: groupId ?? null,
    });
  } catch (error) {
    // error は SQL と本文を含むためログに渡さない。
    if (groupId !== undefined && isForeignKeyViolation(error)) {
      logJson({
        event: "memo.create",
        status: "group_missing",
        userId,
        memoId,
        groupId,
      });
      return { ok: false, error: "group_missing" };
    }
    saveResult = isPrimaryKeyConflict(error)
      ? "primary_key_conflict"
      : "failed";
    if (saveResult === "primary_key_conflict") {
      try {
        existing = await findMemoWithOwner(db, memoId);
      } catch {
        existing = null;
      }
    }
  }

  const decision = decideCreateResult(
    saveResult,
    existing,
    { tag: input.tag, content: input.content, groupId },
    userId,
  );
  switch (decision.kind) {
    case "created":
      return {
        ok: true,
        created: true,
        memo: toMemoResponse({
          id: memoId,
          tag: tag.slug,
          content: input.content,
          url: null,
          imageKey: null,
          mediaType,
          source: "web",
          createdAt,
          groupId: groupId ?? null,
        }),
      };
    case "existing":
      logJson({ event: "memo.create", status: "duplicate", memoId });
      return { ok: true, created: false, memo: toMemoResponse(decision.row) };
    case "conflict":
      logJson({ event: "memo.create", status: "conflict", memoId });
      return { ok: false, error: "conflict" };
    case "save_failed":
      return { ok: false, error: "save_failed" };
  }
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

export async function deleteManyForUser(
  env: Pick<Env, "DB" | "MEDIA">,
  userId: string,
  ids: string[],
): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const rows = await deleteMemosByIds(db, userId, [...new Set(ids)]);
  await deleteImagesForUser(env, userId, rows);
  return { deleted: rows.length };
}

// 消したメモの画像を R2 から消す。失敗はログを残して先へ進む。
export async function deleteImagesForUser(
  env: Pick<Env, "MEDIA">,
  userId: string,
  rows: { id: string; imageKey: string | null }[],
): Promise<void> {
  for (const row of rows) {
    if (!row.imageKey) continue;
    try {
      await deleteMedia(env.MEDIA, row.imageKey);
    } catch {
      logJson({
        event: "memo.image.delete",
        status: "failed",
        userId,
        memoId: row.id,
      });
    }
  }
}

// 「グループに追加」。自分の、どのグループにも入っていない、todo 以外のメモだけを入れる。
// groupId の持ち主の確認は呼び出し側（groups の service）が行う。
export async function assignGroupForUser(
  db: Database,
  userId: string,
  groupId: string,
  ids: string[],
): Promise<
  | { ok: true; added: number; skippedTodo: number }
  | { ok: false; error: "group_missing" }
> {
  const uniqueIds = [...new Set(ids)];
  try {
    const result = await assignMemosToGroup(db, userId, groupId, uniqueIds);
    return { ok: true, ...result };
  } catch (error) {
    if (!isForeignKeyViolation(error)) throw error;
    logJson({
      event: "group.assign",
      status: "group_missing",
      userId,
      groupId,
      count: uniqueIds.length,
    });
    return { ok: false, error: "group_missing" };
  }
}

export async function countByGroupForUser(
  db: Database,
  userId: string,
): Promise<Map<string, number>> {
  const rows = await countMemosByGroup(db, userId);
  return new Map(rows.map((row) => [row.groupId, row.count]));
}

// 実行せずに文を返す。groups の service がグループの行の削除と一緒に db.batch で実行する。
export function deleteInGroupStatement(
  db: Database,
  userId: string,
  groupId: string,
) {
  return deleteMemosInGroupStatement(db, userId, groupId);
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
