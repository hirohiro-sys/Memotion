import { apiFetch } from "@/lib/api-client";

export async function deleteMemo(id: string): Promise<void> {
  const res = await apiFetch(`/api/memos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("failed to delete memo");
}
