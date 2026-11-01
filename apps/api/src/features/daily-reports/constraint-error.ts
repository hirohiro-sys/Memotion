const DAILY_REPORT_UNIQUE = /UNIQUE constraint failed: daily_reports/;
const DRIZZLE_QUERY_ERROR_PREFIX = "Failed query:";
const MAX_CAUSE_DEPTH = 5;

// drizzle が包んだ message には SQL と本文が入る。そこは見ず、cause を辿る。
export function isDailyReportUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth += 1) {
    if (
      current instanceof Error &&
      !current.message.startsWith(DRIZZLE_QUERY_ERROR_PREFIX) &&
      DAILY_REPORT_UNIQUE.test(current.message)
    ) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
