import {
  type ConnpassSyncResponse,
  connpassSyncResponseSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { toConnpassError } from "./connpass-error";

// 「今すぐ取り込む」。
export async function syncConnpass(): Promise<ConnpassSyncResponse> {
  const res = await apiFetch("/api/connpass/sync", { method: "POST" });
  if (!res.ok) throw await toConnpassError(res);
  return connpassSyncResponseSchema.parse(await res.json());
}
