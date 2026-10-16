import type { MemoTag } from "@repo/shared";
import type { MemoRow } from "./repository";

export type ExistingMemoRow = MemoRow & { userId: string };

export type SaveResult = "inserted" | "primary_key_conflict" | "failed";

export type CreateDecision =
  | { kind: "created" }
  | { kind: "existing"; row: ExistingMemoRow }
  | { kind: "conflict" }
  | { kind: "save_failed" };

const PRIMARY_KEY_CONFLICT = /UNIQUE constraint failed: memos\.id(?!\w)/;
const DRIZZLE_QUERY_ERROR_PREFIX = "Failed query:";
const MAX_CAUSE_DEPTH = 5;

// drizzle は D1 のエラーを DrizzleQueryError で包み、message には SQL と params（メモ本文）が入る。
// 本文しだいで誤判定しないよう、包んだ側の message は見ず、cause を辿って memos.id の違反だけを見る。
export function isPrimaryKeyConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth += 1) {
    if (
      current instanceof Error &&
      !current.message.startsWith(DRIZZLE_QUERY_ERROR_PREFIX) &&
      PRIMARY_KEY_CONFLICT.test(current.message)
    ) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

// 同じ id の再送は、自分の行で本文とタグが一致するときだけ既存として返す。
// それ以外は内容を返さず衝突にする（他ユーザーの行の存在や内容を漏らさない）。
export function decideCreateResult(
  saveResult: SaveResult,
  existing: ExistingMemoRow | null,
  input: { tag: MemoTag; content: string },
  userId: string,
): CreateDecision {
  if (saveResult === "inserted") return { kind: "created" };
  if (saveResult === "failed") return { kind: "save_failed" };
  if (!existing) return { kind: "save_failed" };

  const sameRequest =
    existing.userId === userId &&
    existing.tag === input.tag &&
    existing.content === input.content;
  return sameRequest
    ? { kind: "existing", row: existing }
    : { kind: "conflict" };
}
