import {
  type CreateMemoRequest,
  createMemoRequestSchema,
  type Memo,
  memoSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

export async function createMemo(input: CreateMemoRequest): Promise<Memo> {
  const res = await apiFetch("/api/memos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createMemoRequestSchema.parse(input)),
  });
  if (!res.ok) throw new Error("failed to create memo");
  return memoSchema.parse(await res.json());
}
