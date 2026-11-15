import { hasConstraintCause } from "../../db/constraint-error";

const DAILY_REPORT_UNIQUE = /UNIQUE constraint failed: daily_reports/;

export function isDailyReportUniqueViolation(error: unknown): boolean {
  return hasConstraintCause(error, DAILY_REPORT_UNIQUE);
}
