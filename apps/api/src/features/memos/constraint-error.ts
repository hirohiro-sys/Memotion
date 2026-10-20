const FOREIGN_KEY_VIOLATION = /FOREIGN KEY constraint failed/;
const DRIZZLE_QUERY_ERROR_PREFIX = "Failed query:";
const MAX_CAUSE_DEPTH = 5;

// memos.group_id の参照違反（持ち主の確認のあとにグループが消えた）かどうか。
// drizzle が包んだ側の message には SQL と params（メモ本文）が入るため見ず、cause を辿る。
export function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth += 1) {
    if (
      current instanceof Error &&
      !current.message.startsWith(DRIZZLE_QUERY_ERROR_PREFIX) &&
      FOREIGN_KEY_VIOLATION.test(current.message)
    ) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
