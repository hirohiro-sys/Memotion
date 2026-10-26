import {
  type NotificationSettings,
  notificationSettingsSchema,
  type UpdateNotificationSettingsRequest,
} from "@repo/shared";
import { scheduleTargetToMark } from "./window";

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

// 予定の前日通知。二重送信を対象日ごとに1回に制限するため、送った時刻ではなく最後に処理した対象日を持つ。
export type StoredScheduleSettings = {
  enabled: boolean;
  time: string;
  lastTargetDate: string | null;
  disabledReason: string | null;
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

export const DEFAULT_SCHEDULE_DAILY: StoredScheduleSettings = {
  enabled: true,
  time: "20:00",
  lastTargetDate: null,
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

export type ScheduleSettingsChange = {
  enabled: boolean;
  time: string;
  disabledReason: string | null;
  // 処理済みにする対象日。オンにしたか時刻を変えて、通知の時刻がすでに今日に来ているときだけ。
  markTarget: string | null;
};

// 予定の設定の更新。last_target_date には触らず、処理済みにする対象日だけを返す。
export function planScheduleSettingsChange(
  current: StoredScheduleSettings,
  patch: UpdateNotificationSettingsRequest,
  now: Date,
): ScheduleSettingsChange {
  const enabled = patch.scheduleDailyEnabled ?? current.enabled;
  const time = patch.scheduleDailyTime ?? current.time;
  // すでにオンの設定に enabled: true が届いても、オンにしたとは扱わない（再試行中の通知を処理済みにしない）。
  const turningOn = patch.scheduleDailyEnabled === true && !current.enabled;
  const timeChanged =
    patch.scheduleDailyTime !== undefined &&
    patch.scheduleDailyTime !== current.time;
  return {
    enabled,
    time,
    disabledReason:
      patch.scheduleDailyEnabled !== undefined ? null : current.disabledReason,
    markTarget:
      enabled && (turningOn || timeChanged)
        ? scheduleTargetToMark(now, { time })
        : null,
  };
}

export type SettingsSections = {
  techWeekly: boolean;
  todoDaily: boolean;
  scheduleDaily: boolean;
};

// パッチが触る設定の表。変更の無い表は書かない（cron の書き込みを古い値で巻き戻さないため）。
export function changedSections(
  patch: UpdateNotificationSettingsRequest,
): SettingsSections {
  return {
    techWeekly:
      patch.techWeeklyEnabled !== undefined ||
      patch.techWeeklyDay !== undefined ||
      patch.techWeeklyTime !== undefined,
    todoDaily:
      patch.todoDailyEnabled !== undefined || patch.todoDailyTime !== undefined,
    scheduleDaily:
      patch.scheduleDailyEnabled !== undefined ||
      patch.scheduleDailyTime !== undefined,
  };
}

export function toNotificationSettings(
  settings: StoredNotificationSettings,
  pendingCount: number,
  todoPendingCount: number,
  schedule: Pick<StoredScheduleSettings, "enabled" | "time" | "disabledReason">,
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
    scheduleDailyEnabled: schedule.enabled,
    scheduleDailyTime: schedule.time,
    scheduleDisabledReason: schedule.disabledReason,
  });
}
