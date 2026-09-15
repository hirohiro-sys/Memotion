import { z } from "zod";

const techWeeklyTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const notificationSettingsSchema = z.object({
  techWeeklyEnabled: z.boolean(),
  techWeeklyDay: z.number().int().min(0).max(6),
  techWeeklyTime: techWeeklyTimeSchema,
  pendingCount: z.number().int().min(0),
  disabledReason: z.string().nullable(),
});

export const updateNotificationSettingsRequestSchema = z
  .object({
    techWeeklyEnabled: z.boolean(),
    techWeeklyDay: z.number().int().min(0).max(6),
    techWeeklyTime: techWeeklyTimeSchema,
  })
  .partial();

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type UpdateNotificationSettingsRequest = z.infer<
  typeof updateNotificationSettingsRequestSchema
>;
