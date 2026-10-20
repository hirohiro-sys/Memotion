import { type GroupListResponse, groupListResponseSchema } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

export async function fetchGroups(): Promise<GroupListResponse> {
  const res = await apiFetch("/api/groups");
  if (!res.ok) throw new Error("failed to load groups");
  return groupListResponseSchema.parse(await res.json());
}
