import type { MemoTag } from "@repo/shared";
import type { WebMemoRecord } from "./dedup-record";

export type ResendDecision =
  | { kind: "existing"; record: WebMemoRecord }
  | { kind: "conflict" };

// 同じ id の再送は、自分の記録で本文とタグが一致するときだけ既存として返す。
// それ以外は内容を返さず衝突にする（他ユーザーの記録の存在や内容を漏らさない）。
// 予定は日付と時刻も比べる。時刻の省略と null は同じ「時間未定」として扱う。
export function decideResend(
  record: WebMemoRecord,
  input: {
    tag: MemoTag;
    content: string;
    scheduledDate?: string;
    scheduledTime?: string | null;
  },
  userId: string,
): ResendDecision {
  const sameRequest =
    record.userId === userId &&
    record.tag === input.tag &&
    record.content === input.content &&
    (input.tag !== "schedule" ||
      (record.scheduledDate === (input.scheduledDate ?? null) &&
        record.scheduledTime === (input.scheduledTime ?? null)));
  return sameRequest ? { kind: "existing", record } : { kind: "conflict" };
}
