import type { NotificationSettings } from "@repo/shared";

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  techWeeklyEnabled: true,
  techWeeklyDay: 0,
  techWeeklyTime: "20:00",
  pendingCount: 0,
  disabledReason: null,
};
