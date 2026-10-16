import {
  type CreateMemoRequest,
  createMemoRequestSchema,
  memoSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

const SEND_TIMEOUT_MS = 10_000;

// サーバーの返事を、呼び出し側が「消す・残して再試行・ログインへ・送信できません」に分けられる形にする。
export type SendMemoResult =
  | { kind: "saved"; created: boolean }
  | { kind: "retry" }
  | { kind: "unauthorized" }
  | { kind: "rejected"; status: number };

export async function sendMemo(
  input: CreateMemoRequest,
): Promise<SendMemoResult> {
  const parsed = createMemoRequestSchema.safeParse(input);
  if (!parsed.success) return { kind: "rejected", status: 400 };

  let res: Response;
  try {
    res = await apiFetch("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    // 通信の失敗とタイムアウト。
    return { kind: "retry" };
  }

  if (res.status === 200 || res.status === 201) {
    // リダイレクト先のログイン画面などの 200 を、保存済みと取り違えない。
    // 保存済みのメモの形で返ってきたときだけ消す。そうでなければ再送する（同じ id なのでサーバーでは重複しない）。
    if (res.redirected) return { kind: "retry" };
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { kind: "retry" };
    }
    if (!memoSchema.safeParse(body).success) return { kind: "retry" };
    return { kind: "saved", created: res.status === 201 };
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 408 || res.status === 429 || res.status >= 500) {
    return { kind: "retry" };
  }
  return { kind: "rejected", status: res.status };
}
