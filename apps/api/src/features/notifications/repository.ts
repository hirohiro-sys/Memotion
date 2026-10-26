import { and, eq, isNull, lt, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Database } from "../../db";
import {
  memos,
  scheduleDailySettings,
  tags,
  techWeeklySettings,
  todoDailySettings,
  users,
} from "../../db/schema";
import type { DigestMemo } from "./message";
import {
  DEFAULT_SCHEDULE_DAILY,
  type StoredDailySettings,
  type StoredScheduleSettings,
  type StoredSettings,
} from "./settings";

export async function readStoredSettings(
  db: Database,
  userId: string,
): Promise<StoredSettings | null> {
  const [row] = await db
    .select({
      enabled: techWeeklySettings.enabled,
      weekday: techWeeklySettings.weekday,
      time: techWeeklySettings.time,
      lastSentAt: techWeeklySettings.lastSentAt,
      disabledReason: techWeeklySettings.disabledReason,
    })
    .from(techWeeklySettings)
    .where(eq(techWeeklySettings.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertSettings(
  db: Database,
  userId: string,
  settings: StoredSettings,
): Promise<void> {
  const [existing] = await db
    .select({ id: techWeeklySettings.id })
    .from(techWeeklySettings)
    .where(eq(techWeeklySettings.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(techWeeklySettings)
      .set({
        enabled: settings.enabled,
        weekday: settings.weekday,
        time: settings.time,
        lastSentAt: settings.lastSentAt,
        disabledReason: settings.disabledReason,
      })
      .where(eq(techWeeklySettings.userId, userId));
    return;
  }

  await db.insert(techWeeklySettings).values({
    id: nanoid(),
    userId,
    enabled: settings.enabled,
    weekday: settings.weekday,
    time: settings.time,
    lastSentAt: settings.lastSentAt,
    disabledReason: settings.disabledReason,
  });
}

export async function readStoredDailySettings(
  db: Database,
  userId: string,
): Promise<StoredDailySettings | null> {
  const [row] = await db
    .select({
      enabled: todoDailySettings.enabled,
      time: todoDailySettings.time,
      lastSentAt: todoDailySettings.lastSentAt,
      disabledReason: todoDailySettings.disabledReason,
    })
    .from(todoDailySettings)
    .where(eq(todoDailySettings.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertDailySettings(
  db: Database,
  userId: string,
  settings: StoredDailySettings,
): Promise<void> {
  const [existing] = await db
    .select({ id: todoDailySettings.id })
    .from(todoDailySettings)
    .where(eq(todoDailySettings.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(todoDailySettings)
      .set({
        enabled: settings.enabled,
        time: settings.time,
        lastSentAt: settings.lastSentAt,
        disabledReason: settings.disabledReason,
      })
      .where(eq(todoDailySettings.userId, userId));
    return;
  }

  await db.insert(todoDailySettings).values({
    id: nanoid(),
    userId,
    enabled: settings.enabled,
    time: settings.time,
    lastSentAt: settings.lastSentAt,
    disabledReason: settings.disabledReason,
  });
}

export async function readStoredScheduleSettings(
  db: Database,
  userId: string,
): Promise<StoredScheduleSettings | null> {
  const [row] = await db
    .select({
      enabled: scheduleDailySettings.enabled,
      time: scheduleDailySettings.time,
      lastTargetDate: scheduleDailySettings.lastTargetDate,
      disabledReason: scheduleDailySettings.disabledReason,
    })
    .from(scheduleDailySettings)
    .where(eq(scheduleDailySettings.userId, userId))
    .limit(1);
  return row ?? null;
}

// 設定画面からの更新。enabled・time・disabled_reason だけを書き、last_target_date には触らない。
export async function upsertScheduleSettingsColumns(
  db: Database,
  userId: string,
  values: Pick<StoredScheduleSettings, "enabled" | "time" | "disabledReason">,
): Promise<void> {
  await db
    .insert(scheduleDailySettings)
    .values({ id: nanoid(), userId, ...values, lastTargetDate: null })
    .onConflictDoUpdate({ target: scheduleDailySettings.userId, set: values });
}

// 対象日を「先取り」する1文。オンで、まだ処理していない（または古い対象日の）行だけを進める。
// 設定を読んだあとにオフにされたら進めない（送らない）。
// 行が無いときは既定値（オン）の行を作る。進めたら true、すでに処理済みかオフなら false。
export async function claimScheduleTarget(
  db: Database,
  userId: string,
  targetDate: string,
): Promise<boolean> {
  const rows = await db
    .insert(scheduleDailySettings)
    .values({
      id: nanoid(),
      userId,
      enabled: DEFAULT_SCHEDULE_DAILY.enabled,
      time: DEFAULT_SCHEDULE_DAILY.time,
      lastTargetDate: targetDate,
      disabledReason: null,
    })
    .onConflictDoUpdate({
      target: scheduleDailySettings.userId,
      set: { lastTargetDate: targetDate },
      setWhere: and(
        eq(scheduleDailySettings.enabled, true),
        or(
          isNull(scheduleDailySettings.lastTargetDate),
          lt(scheduleDailySettings.lastTargetDate, targetDate),
        ),
      ),
    })
    .returning({ id: scheduleDailySettings.id });
  return rows.length > 0;
}

// 一時的な送信失敗のあと、先取りを元に戻す。別の実行が先へ進めていたら触らない。
export async function revertScheduleTarget(
  db: Database,
  userId: string,
  targetDate: string,
  previous: string | null,
): Promise<void> {
  await db
    .update(scheduleDailySettings)
    .set({ lastTargetDate: previous })
    .where(
      and(
        eq(scheduleDailySettings.userId, userId),
        eq(scheduleDailySettings.lastTargetDate, targetDate),
      ),
    );
}

export async function disableScheduleSettings(
  db: Database,
  userId: string,
  disabledReason: string,
): Promise<void> {
  await db
    .update(scheduleDailySettings)
    .set({ enabled: false, disabledReason })
    .where(eq(scheduleDailySettings.userId, userId));
}

export async function listAllowedUsers(
  db: Database,
): Promise<{ id: string; lineUserId: string }[]> {
  return db.select({ id: users.id, lineUserId: users.lineUserId }).from(users);
}

async function listMemosBySlug(
  db: Database,
  userId: string,
  slug: string,
): Promise<DigestMemo[]> {
  return db
    .select({
      createdAt: memos.createdAt,
      content: memos.content,
      mediaType: memos.mediaType,
      url: memos.url,
    })
    .from(memos)
    .innerJoin(tags, eq(memos.tagId, tags.id))
    .where(and(eq(memos.userId, userId), eq(tags.slug, slug)));
}

export async function listTechMemos(
  db: Database,
  userId: string,
): Promise<DigestMemo[]> {
  return listMemosBySlug(db, userId, "tech");
}

export async function listTodoMemos(
  db: Database,
  userId: string,
): Promise<DigestMemo[]> {
  return listMemosBySlug(db, userId, "todo");
}
