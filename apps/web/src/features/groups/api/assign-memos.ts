import {
  type AssignMemosResponse,
  assignMemosRequestSchema,
  assignMemosResponseSchema,
  MAX_BULK_DELETE,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { throwGroupApiError } from "./errors";

async function assignChunk(
  groupId: string,
  ids: string[],
): Promise<AssignMemosResponse> {
  const res = await apiFetch(
    `/api/groups/${encodeURIComponent(groupId)}/memos/assign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignMemosRequestSchema.parse({ ids })),
    },
  );
  if (!res.ok) await throwGroupApiError(res, "failed to assign memos");
  return assignMemosResponseSchema.parse(await res.json());
}

export async function assignMemos(
  groupId: string,
  ids: string[],
): Promise<AssignMemosResponse> {
  let added = 0;
  let skippedTodo = 0;
  for (let i = 0; i < ids.length; i += MAX_BULK_DELETE) {
    const result = await assignChunk(
      groupId,
      ids.slice(i, i + MAX_BULK_DELETE),
    );
    added += result.added;
    skippedTodo += result.skippedTodo;
  }
  return { added, skippedTodo };
}
