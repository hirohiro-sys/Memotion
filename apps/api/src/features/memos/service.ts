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
import {
  deleteMedia,
  deleteMemoById,
  findByLineMessageId,
  findMemoMedia,
  findTagBySlug,
  getMedia,
  insertMemo,
  isUniqueConstraintError,
  listMemos,
  type MemoRow,
  memoImageKey,
  putMedia,
} from "./repository";

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
    return { status: "inserted" };
  } catch (error) {
    if (isUniqueConstraintError(error)) return { status: "duplicate" };
    return { status: "failed", reason: "save_failed" };
  }
}
