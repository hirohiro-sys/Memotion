import {
  type ApiErrorCode,
  apiErrorSchema,
  type ChangeableMemoTag,
  changeMemoTagRequestSchema,
  type Memo,
  memoSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

// 失敗の理由を、呼び出し側が出し分けられる形で持つ。
export class ChangeMemoTagError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | undefined;

  constructor(status: number, code: ApiErrorCode | undefined) {
    super("failed to change memo tag");
    this.name = "ChangeMemoTagError";
    this.status = status;
    this.code = code;
  }
}

// 保存済みメモのタグを付け直す。予定にする操作は setSchedule が受け持つ。
export async function changeMemoTag(
  memoId: string,
  tag: ChangeableMemoTag,
): Promise<Memo> {
  const res = await apiFetch(`/api/memos/${encodeURIComponent(memoId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changeMemoTagRequestSchema.parse({ tag })),
  });
  if (!res.ok) {
    const body = apiErrorSchema.safeParse(await res.json().catch(() => null));
    throw new ChangeMemoTagError(
      res.status,
      body.success ? body.data.code : undefined,
    );
  }
  return memoSchema.parse(await res.json());
}
