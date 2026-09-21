import type { UpdateNotificationSettingsRequest } from "@repo/shared";
import type { Database } from "../../db";
import {
  listTechMemos,
  listTodoMemos,
  readStoredDailySettings,
  readStoredSettings,
  upsertDailySettings,
  upsertSettings,
} from "./repository";
import {
  applySettingsPatch,
  DEFAULT_TECH_WEEKLY,
  DEFAULT_TODO_DAILY,
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

export async function getNotificationSettings(
  db: Database,
  userId: string,
  now: Date,
) {
  const settings = await loadSettings(db, userId);
  const [pendingCount, todoPendingCount] = await Promise.all([
    pendingCountFor(db, userId, settings.techWeekly, now),
    listTodoMemos(db, userId).then((memos) => memos.length),
  ]);
  return toNotificationSettings(settings, pendingCount, todoPendingCount);
}

export async function updateNotificationSettings(
  db: Database,
  userId: string,
  patch: UpdateNotificationSettingsRequest,
  now: Date,
) {
  const current = await loadSettings(db, userId);
  const next = applySettingsPatch(current, patch, now);
  await upsertSettings(db, userId, next.techWeekly);
  await upsertDailySettings(db, userId, next.todoDaily);
  const [pendingCount, todoPendingCount] = await Promise.all([
    pendingCountFor(db, userId, next.techWeekly, now),
    listTodoMemos(db, userId).then((memos) => memos.length),
  ]);
  return toNotificationSettings(next, pendingCount, todoPendingCount);
}
