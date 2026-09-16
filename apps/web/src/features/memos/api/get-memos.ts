import { type MemoListResponse, memoListResponseSchema } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

export async function fetchMemos(): Promise<MemoListResponse> {
  const res = await apiFetch("/api/memos");
  if (!res.ok) throw new Error("failed to load memos");
  return memoListResponseSchema.parse(await res.json());
}
