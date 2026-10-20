import { type MemoListResponse, memoListResponseSchema } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { throwGroupApiError } from "./errors";

export async function fetchGroupMemos(
  groupId: string,
): Promise<MemoListResponse> {
  const res = await apiFetch(
    `/api/groups/${encodeURIComponent(groupId)}/memos`,
  );
  if (!res.ok) await throwGroupApiError(res, "failed to load group memos");
  return memoListResponseSchema.parse(await res.json());
}
