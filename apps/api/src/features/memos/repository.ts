import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
} from "drizzle-orm";
import type { Database } from "../../db";
import { memos, tags } from "../../db/schema";

export type MemoRow = {
  id: string;
  tag: string;
  content: string;
  url: string | null;
  imageKey: string | null;
  mediaType: string;
  source: string;
  createdAt: string;
  groupId: string | null;
};

export function memoImageKey(userId: string, memoId: string): string {
  return `${userId}/${memoId}`;
}

export function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE constraint failed");
}

// groupId が null ならどのグループにも入っていないメモ、文字列ならそのグループのメモ。
export async function listMemos(
  db: Database,
  userId: string,
  groupId: string | null,
): Promise<MemoRow[]> {
  return db
    .select({
      id: memos.id,
      tag: tags.slug,
      content: memos.content,
      url: memos.url,
      imageKey: memos.imageKey,
      mediaType: memos.mediaType,
      source: memos.source,
      createdAt: memos.createdAt,
      groupId: memos.groupId,
    })
    .from(memos)
    .innerJoin(tags, eq(memos.tagId, tags.id))
    .where(
      and(
        eq(memos.userId, userId),
        groupId === null ? isNull(memos.groupId) : eq(memos.groupId, groupId),
      ),
    )
    .orderBy(desc(memos.createdAt));
}

// 持ち主を確かめずに行を返す。認可（row.userId === sessionUserId）は呼び出し側で必ず行う。
export async function findMemoWithOwner(
  db: Database,
  id: string,
): Promise<(MemoRow & { userId: string }) | null> {
  const [row] = await db
    .select({
      id: memos.id,
      userId: memos.userId,
      tag: tags.slug,
      content: memos.content,
      url: memos.url,
      imageKey: memos.imageKey,
      mediaType: memos.mediaType,
      source: memos.source,
      createdAt: memos.createdAt,
      groupId: memos.groupId,
    })
    .from(memos)
    .innerJoin(tags, eq(memos.tagId, tags.id))
    .where(eq(memos.id, id))
    .limit(1);
  return row ?? null;
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
    groupId?: string | null;
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

export type OgpState = "pending" | "ready" | "failed" | "skipped";

export async function updateMemoOgp(
  db: Database,
  id: string,
  values: { ogpState: OgpState; imageKey?: string },
) {
  await db.update(memos).set(values).where(eq(memos.id, id));
}

export type OgpTarget = { id: string; userId: string; content: string };

function claimableOgp(staleBefore: string) {
  return and(
    eq(memos.mediaType, "url"),
    or(
      isNull(memos.ogpState),
      and(eq(memos.ogpState, "pending"), lt(memos.ogpClaimedAt, staleBefore)),
    ),
  );
}

export async function listClaimableOgpIds(
  db: Database,
  userId: string,
  staleBefore: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: memos.id })
    .from(memos)
    .where(and(eq(memos.userId, userId), claimableOgp(staleBefore)))
    .orderBy(desc(memos.createdAt));
  return rows.map((row) => row.id);
}

export async function claimOgp(
  db: Database,
  id: string,
  now: string,
  staleBefore: string,
): Promise<OgpTarget | null> {
  const [row] = await db
    .update(memos)
    .set({ ogpState: "pending", ogpClaimedAt: now })
    .where(and(eq(memos.id, id), claimableOgp(staleBefore)))
    .returning({
      id: memos.id,
      userId: memos.userId,
      content: memos.content,
    });
  return row ?? null;
}

// D1 は1クエリあたりのバインド変数が100まで。userId の1つ分を引いて余裕を持たせる。
const DELETE_CHUNK_SIZE = 90;

export async function deleteMemosByIds(
  db: Database,
  userId: string,
  ids: string[],
): Promise<{ id: string; imageKey: string | null }[]> {
  const deleted: { id: string; imageKey: string | null }[] = [];
  for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + DELETE_CHUNK_SIZE);
    const rows = await db
      .delete(memos)
      .where(and(eq(memos.userId, userId), inArray(memos.id, chunk)))
      .returning({ id: memos.id, imageKey: memos.imageKey });
    deleted.push(...rows);
  }
  return deleted;
}

function todoTagIds(db: Database) {
  return db.select({ id: tags.id }).from(tags).where(eq(tags.slug, "todo"));
}

// 自分の、どのグループにも入っていない、todo 以外のメモにだけ group_id を付ける。
// 付けた件数と、除いた自分の todo の件数を返す。
export async function assignMemosToGroup(
  db: Database,
  userId: string,
  groupId: string,
  ids: string[],
): Promise<{ added: number; skippedTodo: number }> {
  let added = 0;
  let skippedTodo = 0;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + DELETE_CHUNK_SIZE);
    const [todo] = await db
      .select({ count: count() })
      .from(memos)
      .where(
        and(
          eq(memos.userId, userId),
          inArray(memos.id, chunk),
          inArray(memos.tagId, todoTagIds(db)),
        ),
      );
    skippedTodo += todo?.count ?? 0;

    const rows = await db
      .update(memos)
      .set({ groupId })
      .where(
        and(
          eq(memos.userId, userId),
          isNull(memos.groupId),
          inArray(memos.id, chunk),
          notInArray(memos.tagId, todoTagIds(db)),
        ),
      )
      .returning({ id: memos.id });
    added += rows.length;
  }
  return { added, skippedTodo };
}

export async function countMemosByGroup(
  db: Database,
  userId: string,
): Promise<{ groupId: string; count: number }[]> {
  const rows = await db
    .select({ groupId: memos.groupId, count: count() })
    .from(memos)
    .where(and(eq(memos.userId, userId), isNotNull(memos.groupId)))
    .groupBy(memos.groupId);
  return rows.flatMap((row) =>
    row.groupId === null ? [] : [{ groupId: row.groupId, count: row.count }],
  );
}

// 実行せずに文を返す。呼び出し側がグループの行の削除と一緒に db.batch で実行する。
export function deleteMemosInGroupStatement(
  db: Database,
  userId: string,
  groupId: string,
) {
  return db
    .delete(memos)
    .where(and(eq(memos.userId, userId), eq(memos.groupId, groupId)))
    .returning({ id: memos.id, imageKey: memos.imageKey });
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
