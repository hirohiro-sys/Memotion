import {
  type ApiErrorCode,
  apiErrorSchema,
  type Memo,
  memoSchema,
  type SetScheduleRequest,
  setScheduleRequestSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

// 失敗の理由を、ダイアログが出し分けられる形で持つ。
export class SetScheduleError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | undefined;

  constructor(status: number, code: ApiErrorCode | undefined) {
    super("failed to set schedule");
    this.name = "SetScheduleError";
    this.status = status;
    this.code = code;
  }
}

// つぶやきを予定にする、または予定の日時を変える。
export async function setSchedule(
  memoId: string,
  input: SetScheduleRequest,
): Promise<Memo> {
  const res = await apiFetch(
    `/api/memos/${encodeURIComponent(memoId)}/schedule`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(setScheduleRequestSchema.parse(input)),
    },
  );
  if (!res.ok) {
    const body = apiErrorSchema.safeParse(await res.json().catch(() => null));
    throw new SetScheduleError(
      res.status,
      body.success ? body.data.code : undefined,
    );
  }
  return memoSchema.parse(await res.json());
}
