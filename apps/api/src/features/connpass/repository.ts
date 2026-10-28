import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Database } from "../../db";
import { connpassImports, connpassSettings } from "../../db/schema";
import type { ImportRow } from "./plan";

export type StoredConnpassSettings = {
  nickname: string;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
};

export async function readSettings(
  db: Database,
  userId: string,
): Promise<StoredConnpassSettings | null> {
  const [row] = await db
    .select({
      nickname: connpassSettings.nickname,
      lastSyncedAt: connpassSettings.lastSyncedAt,
      lastSyncStatus: connpassSettings.lastSyncStatus,
    })
    .from(connpassSettings)
    .where(eq(connpassSettings.userId, userId))
    .limit(1);
  return row ?? null;
}

// ユーザー名を保存する。行を初めて作るときだけ last_synced_at が NULL になり、次の Cron で取り込まれる。
// すでに行があるときは触らない（保存のたびに戻すと、先取りと手動の 60 秒の間隔が破れる）。
export async function saveNickname(
  db: Database,
  userId: string,
  nickname: string,
): Promise<void> {
  await db
    .insert(connpassSettings)
    .values({
      id: nanoid(),
      userId,
      nickname,
      lastSyncedAt: null,
      lastSyncStatus: null,
    })
    .onConflictDoUpdate({
      target: connpassSettings.userId,
      // 名前を変えたときだけ、前の名前の取り込み結果（成功・失敗）を消す。
      // last_synced_at は戻さない（戻すと、先取りと手動の 60 秒の間隔が破れる）。
      set: {
        nickname,
        lastSyncStatus: sql`CASE WHEN ${connpassSettings.nickname} = ${nickname} THEN ${connpassSettings.lastSyncStatus} ELSE NULL END`,
      },
    });
}

export async function deleteSettings(
  db: Database,
  userId: string,
): Promise<void> {
  await db.delete(connpassSettings).where(eq(connpassSettings.userId, userId));
}

// 取り込みの開始を「先取り」する。前回から間隔があいているときだけ、last_synced_at を進める。
// 進めたら true。別の実行が先に取った、または間隔が足りないなら false。
export async function claimSync(
  db: Database,
  userId: string,
  nowIso: string,
  notAfterIso: string,
): Promise<boolean> {
  const rows = await db
    .update(connpassSettings)
    .set({ lastSyncedAt: nowIso })
    .where(
      and(
        eq(connpassSettings.userId, userId),
        or(
          isNull(connpassSettings.lastSyncedAt),
          lte(connpassSettings.lastSyncedAt, notAfterIso),
        ),
      ),
    )
    .returning({ id: connpassSettings.id });
  return rows.length > 0;
}

export async function recordSyncStatus(
  db: Database,
  userId: string,
  status: "success" | "failed",
): Promise<void> {
  await db
    .update(connpassSettings)
    .set({ lastSyncStatus: status })
    .where(eq(connpassSettings.userId, userId));
}

// 取り込みの時刻が来たユーザー。まだ一度も取り込んでいない人を先にする。
export async function listDueUsers(
  db: Database,
  notAfterIso: string,
  limit: number,
): Promise<{ userId: string; nickname: string }[]> {
  return db
    .select({
      userId: connpassSettings.userId,
      nickname: connpassSettings.nickname,
    })
    .from(connpassSettings)
    .where(
      or(
        isNull(connpassSettings.lastSyncedAt),
        lte(connpassSettings.lastSyncedAt, notAfterIso),
      ),
    )
    .orderBy(asc(connpassSettings.lastSyncedAt))
    .limit(limit);
}

export async function listImports(
  db: Database,
  userId: string,
): Promise<ImportRow[]> {
  return db
    .select({
      eventId: connpassImports.eventId,
      memoId: connpassImports.memoId,
      importedTitle: connpassImports.importedTitle,
      importedDate: connpassImports.importedDate,
      importedTime: connpassImports.importedTime,
    })
    .from(connpassImports)
    .where(eq(connpassImports.userId, userId));
}

// 以下3つは、実行せずに文を返す。memos の予定の文と一緒に db.batch で実行する。
export function insertImportStatement(
  db: Database,
  values: {
    userId: string;
    eventId: number;
    memoId: string;
    title: string;
    date: string;
    time: string | null;
    createdAt: string;
  },
) {
  return db.insert(connpassImports).values({
    id: nanoid(),
    userId: values.userId,
    eventId: values.eventId,
    memoId: values.memoId,
    importedTitle: values.title,
    importedDate: values.date,
    importedTime: values.time,
    createdAt: values.createdAt,
  });
}

export function updateImportStatement(
  db: Database,
  values: {
    userId: string;
    eventId: number;
    title: string;
    date: string;
    time: string | null;
  },
) {
  return db
    .update(connpassImports)
    .set({
      importedTitle: values.title,
      importedDate: values.date,
      importedTime: values.time,
    })
    .where(
      and(
        eq(connpassImports.userId, values.userId),
        eq(connpassImports.eventId, values.eventId),
      ),
    );
}

export function deleteImportStatement(
  db: Database,
  userId: string,
  eventId: number,
) {
  return db
    .delete(connpassImports)
    .where(
      and(
        eq(connpassImports.userId, userId),
        eq(connpassImports.eventId, eventId),
      ),
    );
}
