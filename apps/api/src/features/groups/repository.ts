import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../../db";
import { groups } from "../../db/schema";

export type GroupRow = {
  id: string;
  name: string;
  createdAt: string;
  lastAddedAt: string;
};

export type NewGroupRow = GroupRow & { userId: string };

const groupColumns = {
  id: groups.id,
  name: groups.name,
  createdAt: groups.createdAt,
  lastAddedAt: groups.lastAddedAt,
};

export async function listGroupsForUser(
  db: Database,
  userId: string,
): Promise<GroupRow[]> {
  return db
    .select(groupColumns)
    .from(groups)
    .where(eq(groups.userId, userId))
    .orderBy(desc(groups.lastAddedAt), desc(groups.createdAt), desc(groups.id));
}

export async function findGroupForUser(
  db: Database,
  userId: string,
  groupId: string,
): Promise<GroupRow | undefined> {
  const [row] = await db
    .select(groupColumns)
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.userId, userId)))
    .limit(1);
  return row;
}

export async function insertGroup(
  db: Database,
  row: NewGroupRow,
): Promise<void> {
  await db.insert(groups).values(row);
}

// 更新後の行を返す。他人の ID や存在しない ID なら undefined。
export async function renameGroupForUser(
  db: Database,
  userId: string,
  groupId: string,
  name: string,
): Promise<GroupRow | undefined> {
  const [row] = await db
    .update(groups)
    .set({ name })
    .where(and(eq(groups.id, groupId), eq(groups.userId, userId)))
    .returning(groupColumns);
  return row;
}

export async function touchGroupForUser(
  db: Database,
  userId: string,
  groupId: string,
  at: string,
): Promise<void> {
  await db
    .update(groups)
    .set({ lastAddedAt: at })
    .where(and(eq(groups.id, groupId), eq(groups.userId, userId)));
}

// 実行しない。service が db.batch([...]) に渡す。
export function deleteGroupStatement(
  db: Database,
  userId: string,
  groupId: string,
) {
  return db
    .delete(groups)
    .where(and(eq(groups.id, groupId), eq(groups.userId, userId)));
}
