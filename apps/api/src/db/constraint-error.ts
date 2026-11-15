const DRIZZLE_QUERY_ERROR_PREFIX = "Failed query:";
const MAX_CAUSE_DEPTH = 5;

// 制約違反の message が pattern に合うかどうか。
// drizzle は D1 のエラーを DrizzleQueryError で包み、包んだ側の message には SQL と params（本文など）が入る。
// 本文しだいで誤判定しないよう、包んだ側の message は見ず、cause を辿って D1 のエラーだけを見る。
export function hasConstraintCause(error: unknown, pattern: RegExp): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth += 1) {
    if (
      current instanceof Error &&
      !current.message.startsWith(DRIZZLE_QUERY_ERROR_PREFIX) &&
      pattern.test(current.message)
    ) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
