import type { Database } from "../../db";
import {
  listTechMemos,
  readStoredSettings,
  upsertSettings,
} from "./repository";
import type { UpdateNotificationSettingsRequest } from "./schema";
import {
  applySettingsPatch,
  DEFAULT_TECH_WEEKLY,
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

export async function getNotificationSettings(
  db: Database,
  userId: string,
  now: Date,
) {
  const settings =
    (await readStoredSettings(db, userId)) ?? DEFAULT_TECH_WEEKLY;
  const pendingCount = await pendingCountFor(db, userId, settings, now);
  return toNotificationSettings(settings, pendingCount);
}

export async function updateNotificationSettings(
  db: Database,
  userId: string,
  patch: UpdateNotificationSettingsRequest,
  now: Date,
) {
  const current = await readStoredSettings(db, userId);
  const next = applySettingsPatch(current, patch, now);
  await upsertSettings(db, userId, next);
  const pendingCount = await pendingCountFor(db, userId, next, now);
  return toNotificationSettings(next, pendingCount);
}
