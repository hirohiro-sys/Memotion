import { type ConnpassSettings, connpassSettingsSchema } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

export async function fetchConnpassSettings(): Promise<ConnpassSettings> {
  const res = await apiFetch("/api/connpass/settings");
  if (!res.ok) throw new Error("failed to load connpass settings");
  return connpassSettingsSchema.parse(await res.json());
}
