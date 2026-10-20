const DUPLICATE_NAME =
  /UNIQUE constraint failed: groups\.user_id, groups\.name(?![\w.])/;
const DRIZZLE_QUERY_ERROR_PREFIX = "Failed query:";
const MAX_CAUSE_DEPTH = 5;

// 同じユーザーの中で同じ名前のグループ（(user_id, name) の一意制約違反）かどうか。
// drizzle が包んだ側の message には params としてグループ名が入るため見ず、cause を辿る。
export function isDuplicateGroupName(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth += 1) {
    if (
      current instanceof Error &&
      !current.message.startsWith(DRIZZLE_QUERY_ERROR_PREFIX) &&
      DUPLICATE_NAME.test(current.message)
    ) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
