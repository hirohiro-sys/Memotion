import {
  type CreateGroupMemoRequest,
  createGroupMemoRequestSchema,
  type Memo,
  memoSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { throwGroupApiError, UnauthorizedError } from "./errors";

// 未送信リストを通さず、直接サーバーに送る。
export async function createGroupMemo(
  groupId: string,
  input: CreateGroupMemoRequest,
): Promise<Memo> {
  const res = await apiFetch(
    `/api/groups/${encodeURIComponent(groupId)}/memos`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createGroupMemoRequestSchema.parse(input)),
    },
  );
  if (res.status === 401) throw new UnauthorizedError();
  // 409 は同じ id の別のメモ。グループ名の重複ではない。
  if (res.status === 409) throw new Error("memo id conflict");
  if (!res.ok) await throwGroupApiError(res, "failed to create memo");
  return memoSchema.parse(await res.json());
}
