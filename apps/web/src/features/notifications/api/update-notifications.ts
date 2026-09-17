import {
  type NotificationSettings,
  notificationSettingsSchema,
  type UpdateNotificationSettingsRequest,
  updateNotificationSettingsRequestSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

export async function updateNotifications(
  input: UpdateNotificationSettingsRequest,
): Promise<NotificationSettings> {
  const res = await apiFetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateNotificationSettingsRequestSchema.parse(input)),
  });
  if (!res.ok) throw new Error("failed to update notifications");
  return notificationSettingsSchema.parse(await res.json());
}
