import { desc, eq } from "drizzle-orm";
import type { Database } from "../../db";
import { memos, tags } from "../../db/schema";

export type MemoRow = {
  id: string;
  tag: string;
  content: string;
  url: string | null;
  mediaType: string;
  source: string;
  createdAt: string;
};

export function memoImageKey(userId: string, memoId: string): string {
  return `${userId}/${memoId}`;
}

export function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE constraint failed");
}

export async function listMemos(
  db: Database,
  userId: string,
): Promise<MemoRow[]> {
  return db
    .select({
      id: memos.id,
      tag: tags.slug,
      content: memos.content,
      url: memos.url,
      mediaType: memos.mediaType,
      source: memos.source,
      createdAt: memos.createdAt,
    })
    .from(memos)
    .innerJoin(tags, eq(memos.tagId, tags.id))
    .where(eq(memos.userId, userId))
    .orderBy(desc(memos.createdAt));
}

export async function findTagBySlug(db: Database, slug: string) {
  const [tag] = await db
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);
  return tag ?? null;
}

export async function insertMemo(
  db: Database,
  values: {
    id: string;
    userId: string;
    tagId: string;
    content: string;
    url: string | null;
    imageKey: string | null;
    source: string;
    mediaType: string;
    lineMessageId: string | null;
    createdAt: string;
  },
) {
  await db.insert(memos).values(values);
}

export async function findMemoMedia(
  db: Database,
  id: string,
): Promise<{ userId: string; imageKey: string | null } | null> {
  const [row] = await db
    .select({
      userId: memos.userId,
      imageKey: memos.imageKey,
    })
    .from(memos)
    .where(eq(memos.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteMemoById(db: Database, id: string) {
  await db.delete(memos).where(eq(memos.id, id));
}

export async function findByLineMessageId(
  db: Database,
  lineMessageId: string,
): Promise<{ id: string } | null> {
  const [existing] = await db
    .select({ id: memos.id })
    .from(memos)
    .where(eq(memos.lineMessageId, lineMessageId))
    .limit(1);
  return existing ?? null;
}

export async function putMedia(
  media: R2Bucket,
  key: string,
  body: ArrayBuffer,
  contentType: string,
) {
  await media.put(key, body, {
    httpMetadata: { contentType },
  });
}

export async function getMedia(media: R2Bucket, key: string) {
  return media.get(key);
}

export async function deleteMedia(media: R2Bucket, key: string) {
  await media.delete(key);
}
