import { type User, userSchema } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

export async function fetchMe(): Promise<User | null> {
  const res = await apiFetch("/api/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("failed to load session");
  return userSchema.parse(await res.json());
}
