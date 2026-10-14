import {
  type DeleteMemosResponse,
  deleteMemosRequestSchema,
  deleteMemosResponseSchema,
  MAX_BULK_DELETE,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

async function deleteChunk(ids: string[]): Promise<DeleteMemosResponse> {
  const res = await apiFetch("/api/memos/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deleteMemosRequestSchema.parse({ ids })),
  });
  if (!res.ok) throw new Error("failed to delete memos");
  return deleteMemosResponseSchema.parse(await res.json());
}

export async function deleteMemos(ids: string[]): Promise<DeleteMemosResponse> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += MAX_BULK_DELETE) {
    deleted += (await deleteChunk(ids.slice(i, i + MAX_BULK_DELETE))).deleted;
  }
  return { deleted };
}
