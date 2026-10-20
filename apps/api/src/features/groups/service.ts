import {
  type CreateGroupMemoRequest,
  type Group,
  groupListResponseSchema,
  groupSchema,
} from "@repo/shared";
import { nanoid } from "nanoid";
import { createDb, type Database } from "../../db";
import type { Env } from "../../env";
import {
  assignGroupForUser,
  countByGroupForUser,
  createForUser as createMemo,
  deleteImagesForUser,
  deleteInGroupStatement,
  listForUser as listMemos,
} from "../memos/service";
import { isDuplicateGroupName } from "./name";
import {
  deleteGroupStatement,
  findGroupForUser,
  type GroupRow,
  insertGroup,
  listGroupsForUser,
  renameGroupForUser,
  touchGroupForUser,
} from "./repository";
import { type GroupWrite, shouldTouchGroup } from "./touch";

function toGroupResponse(row: GroupRow, memoCount: number): Group {
  return groupSchema.parse({
    id: row.id,
    name: row.name,
    memoCount,
    lastAddedAt: row.lastAddedAt,
    createdAt: row.createdAt,
  });
}

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

export async function listForUser(db: Database, userId: string) {
  const [rows, counts] = await Promise.all([
    listGroupsForUser(db, userId),
    countByGroupForUser(db, userId),
  ]);
  return groupListResponseSchema.parse({
    items: rows.map((row) => toGroupResponse(row, counts.get(row.id) ?? 0)),
  });
}

export async function createForUser(
  db: Database,
  userId: string,
  name: string,
): Promise<
  { ok: true; group: Group } | { ok: false; error: "duplicate" | "failed" }
> {
  const now = new Date().toISOString();
  const row: GroupRow = {
    id: nanoid(),
    name,
    createdAt: now,
    lastAddedAt: now,
  };
  try {
    await insertGroup(db, { ...row, userId });
  } catch (error) {
    // error は params としてグループ名を含む。投げ直すと既定のハンドラがそのままログに出すので、ID だけ残す。
    if (isDuplicateGroupName(error)) return { ok: false, error: "duplicate" };
    logJson({
      event: "group.create",
      status: "failed",
      userId,
      groupId: row.id,
    });
    return { ok: false, error: "failed" };
  }
  return { ok: true, group: toGroupResponse(row, 0) };
}

export async function renameForUser(
  db: Database,
  userId: string,
  groupId: string,
  name: string,
): Promise<
  | { ok: true; group: Group }
  | { ok: false; error: "not_found" | "duplicate" | "failed" }
> {
  let row: GroupRow | undefined;
  try {
    row = await renameGroupForUser(db, userId, groupId, name);
  } catch (error) {
    // error は params としてグループ名を含むため、投げ直さず ID だけ残す。
    if (isDuplicateGroupName(error)) return { ok: false, error: "duplicate" };
    logJson({ event: "group.rename", status: "failed", userId, groupId });
    return { ok: false, error: "failed" };
  }
  if (!row) return { ok: false, error: "not_found" };

  const counts = await countByGroupForUser(db, userId);
  return { ok: true, group: toGroupResponse(row, counts.get(row.id) ?? 0) };
}

// グループと中のメモを1つのトランザクション（D1 の batch）で消し、そのあと画像を R2 から消す。
export async function deleteForUser(
  env: Pick<Env, "DB" | "MEDIA">,
  userId: string,
  groupId: string,
): Promise<
  | { ok: true; deletedMemos: number }
  | { ok: false; error: "not_found" | "failed" }
> {
  const db = createDb(env.DB);
  const group = await findGroupForUser(db, userId, groupId);
  if (!group) return { ok: false, error: "not_found" };

  let deletedMemos: { id: string; imageKey: string | null }[];
  try {
    [deletedMemos] = await db.batch([
      deleteInGroupStatement(db, userId, groupId),
      deleteGroupStatement(db, userId, groupId),
    ]);
  } catch {
    logJson({ event: "group.delete", status: "failed", userId, groupId });
    return { ok: false, error: "failed" };
  }

  await deleteImagesForUser(env, userId, deletedMemos);
  return { ok: true, deletedMemos: deletedMemos.length };
}

export async function listMemosForUser(
  db: Database,
  userId: string,
  groupId: string,
) {
  const group = await findGroupForUser(db, userId, groupId);
  if (!group) return null;
  return listMemos(db, userId, { groupId });
}

export async function createMemoForUser(
  db: Database,
  userId: string,
  groupId: string,
  input: CreateGroupMemoRequest,
) {
  const group = await findGroupForUser(db, userId, groupId);
  if (!group) return { ok: false as const, error: "group_missing" as const };

  const result = await createMemo(db, userId, input, { groupId });
  if (result.ok) {
    await touchIfNeeded(db, userId, groupId, {
      kind: "create",
      created: result.created,
    });
  }
  return result;
}

export async function assignMemosForUser(
  db: Database,
  userId: string,
  groupId: string,
  ids: string[],
) {
  const group = await findGroupForUser(db, userId, groupId);
  if (!group) return { ok: false as const, error: "group_missing" as const };

  const result = await assignGroupForUser(db, userId, groupId, ids);
  if (result.ok) {
    await touchIfNeeded(db, userId, groupId, {
      kind: "assign",
      added: result.added,
    });
  }
  return result;
}

// メモの保存は済んでいるので、更新に失敗しても成功として返す（並び順がずれるだけ）。
async function touchIfNeeded(
  db: Database,
  userId: string,
  groupId: string,
  write: GroupWrite,
) {
  if (!shouldTouchGroup(write)) return;
  try {
    await touchGroupForUser(db, userId, groupId, new Date().toISOString());
  } catch {
    logJson({ event: "group.touch", status: "failed", userId, groupId });
  }
}
