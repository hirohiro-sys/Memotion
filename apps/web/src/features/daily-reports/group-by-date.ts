import type { DailyReportSummary } from "@repo/shared";

export type DailyReportDateRow = {
  reportDate: string;
  work: DailyReportSummary | null;
  personal: DailyReportSummary | null;
};

// 1行が1日。列は仕事と個人。同じ種類が複数あっても先の1件だけ残す。
export function groupDailyReportsByDate(
  reports: DailyReportSummary[],
): DailyReportDateRow[] {
  const byDate = new Map<string, DailyReportDateRow>();
  for (const report of reports) {
    const row = byDate.get(report.reportDate) ?? {
      reportDate: report.reportDate,
      work: null,
      personal: null,
    };
    if (row[report.kind] === null) row[report.kind] = report;
    byDate.set(report.reportDate, row);
  }
  return [...byDate.values()].sort((a, b) =>
    b.reportDate.localeCompare(a.reportDate),
  );
}
