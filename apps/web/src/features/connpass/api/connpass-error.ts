import { type ApiErrorCode, apiErrorSchema } from "@repo/shared";

// 失敗の理由（コード）を、画面が出し分けられる形で持つ。
export class ConnpassError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | undefined;

  constructor(status: number, code: ApiErrorCode | undefined) {
    super("connpass request failed");
    this.name = "ConnpassError";
    this.status = status;
    this.code = code;
  }
}

export async function toConnpassError(res: Response): Promise<ConnpassError> {
  const body = apiErrorSchema.safeParse(await res.json().catch(() => null));
  return new ConnpassError(
    res.status,
    body.success ? body.data.code : undefined,
  );
}
