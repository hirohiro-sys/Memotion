import { apiFetch } from "@/lib/api-client";

export async function logout(): Promise<void> {
  const res = await apiFetch("/api/auth/logout", { method: "POST" });
  if (!res.ok && res.status !== 204) throw new Error("logout failed");
}
