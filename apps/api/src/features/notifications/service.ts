import type { UpdateNotificationSettingsRequest } from "@repo/shared";
import type { Database } from "../../db";
import {
  claimScheduleTarget,
  listTechMemos,
  listTodoMemos,
  readStoredDailySettings,
  readStoredScheduleSettings,
  readStoredSettings,
  upsertDailySettings,
  upsertScheduleSettingsColumns,
  upsertSettings,
} from "./repository";
import {
  applySettingsPatch,
  changedSections,
  DEFAULT_SCHEDULE_DAILY,
  DEFAULT_TECH_WEEKLY,
  DEFAULT_TODO_DAILY,
  planScheduleSettingsChange,
  type StoredNotificationSettings,
  type StoredSettings,
  toNotificationSettings,
} from "./settings";
import { isInstantInWindow, nextDigestWindow } from "./window";

async function pendingCountFor(
  db: Database,
  userId: string,
  settings: StoredSettings,
  now: Date,
): Promise<number> {
  const window = nextDigestWindow(
    now,
    { weekday: settings.weekday, time: settings.time },
    settings.lastSentAt,
  );
  const memos = await listTechMemos(db, userId);
  return memos.filter((row) => isInstantInWindow(row.createdAt, window)).length;
}

async function loadSettings(
  db: Database,
  userId: string,
): Promise<StoredNotificationSettings> {
  const [techWeekly, todoDaily] = await Promise.all([
    readStoredSettings(db, userId),
    readStoredDailySettings(db, userId),
  ]);
  return {
    techWeekly: techWeekly ?? DEFAULT_TECH_WEEKLY,
    todoDaily: todoDaily ?? DEFAULT_TODO_DAILY,
  };
}

async function loadScheduleSettings(db: Database, userId: string) {
  return (
    (await readStoredScheduleSettings(db, userId)) ?? DEFAULT_SCHEDULE_DAILY
  );
}

export async function getNotificationSettings(
  db: Database,
  userId: string,
  now: Date,
) {
  const [settings, schedule] = await Promise.all([
    loadSettings(db, userId),
    loadScheduleSettings(db, userId),
  ]);
  const [pendingCount, todoPendingCount] = await Promise.all([
    pendingCountFor(db, userId, settings.techWeekly, now),
    listTodoMemos(db, userId).then((memos) => memos.length),
  ]);
  return toNotificationSettings(
    settings,
    pendingCount,
    todoPendingCount,
    schedule,
  );
}

export async function updateNotificationSettings(
  db: Database,
  userId: string,
  patch: UpdateNotificationSettingsRequest,
  now: Date,
) {
  const [current, currentSchedule] = await Promise.all([
    loadSettings(db, userId),
    loadScheduleSettings(db, userId),
  ]);
  const next = applySettingsPatch(current, patch, now);
  const schedule = planScheduleSettingsChange(currentSchedule, patch, now);
  // 変更のあった表だけを書く。読んだ値で全部を書き戻すと、cron の書き込みを巻き戻しうる。
  const sections = changedSections(patch);
  if (sections.techWeekly) await upsertSettings(db, userId, next.techWeekly);
  if (sections.todoDaily) await upsertDailySettings(db, userId, next.todoDaily);
  if (sections.scheduleDaily) {
    await upsertScheduleSettingsColumns(db, userId, {
      enabled: schedule.enabled,
      time: schedule.time,
      disabledReason: schedule.disabledReason,
    });
    // すぐには送らない。通知の時刻がすでに今日に来ていれば、その対象日を処理済みにする。
    if (schedule.markTarget !== null) {
      await claimScheduleTarget(db, userId, schedule.markTarget);
    }
  }
  const [pendingCount, todoPendingCount] = await Promise.all([
    pendingCountFor(db, userId, next.techWeekly, now),
    listTodoMemos(db, userId).then((memos) => memos.length),
  ]);
  return toNotificationSettings(next, pendingCount, todoPendingCount, schedule);
}
