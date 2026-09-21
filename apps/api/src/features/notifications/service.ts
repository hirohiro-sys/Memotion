import type { UpdateNotificationSettingsRequest } from "@repo/shared";
import type { Database } from "../../db";
import {
  listTechMemos,
  readStoredSettings,
  upsertSettings,
} from "./repository";
import {
  applySettingsPatch,
  DEFAULT_NOTIFICATION_SETTINGS,
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
  const techWeekly =
    (await readStoredSettings(db, userId)) ?? DEFAULT_TECH_WEEKLY;
  const settings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    techWeekly,
  };
  const pendingCount = await pendingCountFor(db, userId, techWeekly, now);
  return toNotificationSettings(settings, pendingCount);
}

export async function updateNotificationSettings(
  db: Database,
  userId: string,
  patch: UpdateNotificationSettingsRequest,
  now: Date,
) {
  const techWeekly = await readStoredSettings(db, userId);
  const next = applySettingsPatch(
    techWeekly ? { ...DEFAULT_NOTIFICATION_SETTINGS, techWeekly } : null,
    patch,
    now,
  );
  await upsertSettings(db, userId, next.techWeekly);
  const pendingCount = await pendingCountFor(db, userId, next.techWeekly, now);
  return toNotificationSettings(next, pendingCount);
}
