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

export const DEFAULT_TECH_WEEKLY: StoredSettings = {
  enabled: true,
  weekday: 0,
  time: "20:00",
  lastSentAt: null,
  disabledReason: null,
};

export const UNREACHABLE_DISABLED_REASON =
  "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください";

export function applySettingsPatch(
  current: StoredSettings | null,
  patch: UpdateNotificationSettingsRequest,
  now: Date,
): StoredSettings {
  const base = current ?? DEFAULT_TECH_WEEKLY;
  const turningOn = patch.techWeeklyEnabled === true;
  const slotChanged =
    (patch.techWeeklyDay !== undefined &&
      patch.techWeeklyDay !== base.weekday) ||
    (patch.techWeeklyTime !== undefined && patch.techWeeklyTime !== base.time);

  return {
    enabled: patch.techWeeklyEnabled ?? base.enabled,
    weekday: patch.techWeeklyDay ?? base.weekday,
    time: patch.techWeeklyTime ?? base.time,
    lastSentAt: turningOn || slotChanged ? now.toISOString() : base.lastSentAt,
    disabledReason:
      patch.techWeeklyEnabled !== undefined ? null : base.disabledReason,
  };
}

export function toNotificationSettings(
  settings: StoredSettings,
  pendingCount: number,
): NotificationSettings {
  return notificationSettingsSchema.parse({
    techWeeklyEnabled: settings.enabled,
    techWeeklyDay: settings.weekday,
    techWeeklyTime: settings.time,
    pendingCount,
    disabledReason: settings.disabledReason,
    todoDailyEnabled: true,
    todoDailyTime: "08:00",
    todoPendingCount: 0,
    todoDisabledReason: null,
  });
}
