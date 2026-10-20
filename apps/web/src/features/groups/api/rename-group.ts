import {
  type Group,
  groupSchema,
  renameGroupRequestSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { throwGroupApiError } from "./errors";

export async function renameGroup(
  groupId: string,
  name: string,
): Promise<Group> {
  const res = await apiFetch(`/api/groups/${encodeURIComponent(groupId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(renameGroupRequestSchema.parse({ name })),
  });
  if (!res.ok) await throwGroupApiError(res, "failed to rename group");
  return groupSchema.parse(await res.json());
}
