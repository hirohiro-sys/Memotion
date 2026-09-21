import {
  type NotificationSettings,
  notificationSettingsSchema,
  type UpdateNotificationSettingsRequest,
} from "@repo/shared";

export type StoredSettings = {
  enabled: boolean;
  weekday: number;
  time: string;
  lastSentAt: string | null;
  disabledReason: string | null;
};

export type StoredDailySettings = {
  enabled: boolean;
  time: string;
  lastSentAt: string | null;
  disabledReason: string | null;
};

export type StoredNotificationSettings = {
  techWeekly: StoredSettings;
  todoDaily: StoredDailySettings;
};

export const DEFAULT_TECH_WEEKLY: StoredSettings = {
  enabled: true,
  weekday: 0,
  time: "20:00",
  lastSentAt: null,
  disabledReason: null,
};

export const DEFAULT_TODO_DAILY: StoredDailySettings = {
  enabled: true,
  time: "08:00",
  lastSentAt: null,
  disabledReason: null,
};

export const DEFAULT_NOTIFICATION_SETTINGS: StoredNotificationSettings = {
  techWeekly: DEFAULT_TECH_WEEKLY,
  todoDaily: DEFAULT_TODO_DAILY,
};

export const UNREACHABLE_DISABLED_REASON =
  "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください";

export function applySettingsPatch(
  current: StoredNotificationSettings | null,
  patch: UpdateNotificationSettingsRequest,
  now: Date,
): StoredNotificationSettings {
  const techWeekly = current?.techWeekly ?? DEFAULT_TECH_WEEKLY;
  const todoDaily = current?.todoDaily ?? DEFAULT_TODO_DAILY;
  const turningOn = patch.techWeeklyEnabled === true;
  const slotChanged =
    (patch.techWeeklyDay !== undefined &&
      patch.techWeeklyDay !== techWeekly.weekday) ||
    (patch.techWeeklyTime !== undefined &&
      patch.techWeeklyTime !== techWeekly.time);
  const todoTurningOn = patch.todoDailyEnabled === true;
  const todoSlotChanged =
    patch.todoDailyTime !== undefined && patch.todoDailyTime !== todoDaily.time;

  return {
    techWeekly: {
      enabled: patch.techWeeklyEnabled ?? techWeekly.enabled,
      weekday: patch.techWeeklyDay ?? techWeekly.weekday,
      time: patch.techWeeklyTime ?? techWeekly.time,
      lastSentAt:
        turningOn || slotChanged ? now.toISOString() : techWeekly.lastSentAt,
      disabledReason:
        patch.techWeeklyEnabled !== undefined
          ? null
          : techWeekly.disabledReason,
    },
    todoDaily: {
      enabled: patch.todoDailyEnabled ?? todoDaily.enabled,
      time: patch.todoDailyTime ?? todoDaily.time,
      lastSentAt:
        todoTurningOn || todoSlotChanged
          ? now.toISOString()
          : todoDaily.lastSentAt,
      disabledReason:
        patch.todoDailyEnabled !== undefined ? null : todoDaily.disabledReason,
    },
  };
}

export function toNotificationSettings(
  settings: StoredNotificationSettings,
  pendingCount: number,
  todoPendingCount = 0,
): NotificationSettings {
  return notificationSettingsSchema.parse({
    techWeeklyEnabled: settings.techWeekly.enabled,
    techWeeklyDay: settings.techWeekly.weekday,
    techWeeklyTime: settings.techWeekly.time,
    pendingCount,
    disabledReason: settings.techWeekly.disabledReason,
    todoDailyEnabled: settings.todoDaily.enabled,
    todoDailyTime: settings.todoDaily.time,
    todoPendingCount,
    todoDisabledReason: settings.todoDaily.disabledReason,
  });
}
