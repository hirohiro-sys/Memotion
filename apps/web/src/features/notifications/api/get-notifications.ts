import {
  type NotificationSettings,
  notificationSettingsSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

export async function fetchNotifications(): Promise<NotificationSettings> {
  const res = await apiFetch("/api/notifications");
  if (!res.ok) throw new Error("failed to load notifications");
  return notificationSettingsSchema.parse(await res.json());
}
