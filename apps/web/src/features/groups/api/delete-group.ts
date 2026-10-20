import {
  type DeleteGroupResponse,
  deleteGroupResponseSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { throwGroupApiError } from "./errors";

export async function deleteGroup(
  groupId: string,
): Promise<DeleteGroupResponse> {
  const res = await apiFetch(`/api/groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
  });
  if (!res.ok) await throwGroupApiError(res, "failed to delete group");
  return deleteGroupResponseSchema.parse(await res.json());
}
