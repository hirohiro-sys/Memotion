import {
  type ConnpassSettings,
  connpassSettingsSchema,
  type UpdateConnpassSettingsRequest,
  updateConnpassSettingsRequestSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { toConnpassError } from "./connpass-error";

// ユーザー名を保存する。null なら消して、取り込みを止める。
export async function updateConnpassSettings(
  input: UpdateConnpassSettingsRequest,
): Promise<ConnpassSettings> {
  const res = await apiFetch("/api/connpass/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateConnpassSettingsRequestSchema.parse(input)),
  });
  if (!res.ok) throw await toConnpassError(res);
  return connpassSettingsSchema.parse(await res.json());
}
