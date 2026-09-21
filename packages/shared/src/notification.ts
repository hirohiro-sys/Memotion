import { z } from "zod";

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const notificationSettingsSchema = z.object({
  techWeeklyEnabled: z.boolean(),
  techWeeklyDay: z.number().int().min(0).max(6),
  techWeeklyTime: clockTimeSchema,
  pendingCount: z.number().int().min(0),
  disabledReason: z.string().nullable(),
  todoDailyEnabled: z.boolean(),
  todoDailyTime: clockTimeSchema,
  todoPendingCount: z.number().int().min(0),
  todoDisabledReason: z.string().nullable(),
});

export const updateNotificationSettingsRequestSchema = z
  .object({
    techWeeklyEnabled: z.boolean(),
    techWeeklyDay: z.number().int().min(0).max(6),
    techWeeklyTime: clockTimeSchema,
    todoDailyEnabled: z.boolean(),
    todoDailyTime: clockTimeSchema,
  })
  .partial();

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type UpdateNotificationSettingsRequest = z.infer<
  typeof updateNotificationSettingsRequestSchema
>;
