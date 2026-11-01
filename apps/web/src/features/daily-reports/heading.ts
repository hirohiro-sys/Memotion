import type { DailyReportKind } from "@repo/shared";
import { formatScheduleDate } from "@/features/schedule/jst";

const KIND_LABEL: Record<DailyReportKind, string> = {
  work: "仕事",
  personal: "個人",
};

export function dailyReportHeading(report: {
  reportDate: string;
  kind: DailyReportKind;
}): string {
  return `${formatScheduleDate(report.reportDate)} ${KIND_LABEL[report.kind]}`;
}
