import type { DailyReportStatus, DailyReportSummary } from "@repo/shared";
import { Link } from "@tanstack/react-router";

const STATUS_LABEL: Record<DailyReportStatus, string> = {
  draft: "下書き",
  confirmed: "確定",
};

export function DailyReportSlot({
  report,
  dateLabel,
  kindLabel,
}: {
  report: DailyReportSummary | null;
  dateLabel: string;
  kindLabel: string;
}) {
  if (!report) {
    return <span className="text-body-sm text-stone">—</span>;
  }
  const status = STATUS_LABEL[report.status];
  return (
    <Link
      to="/daily-reports/$id"
      params={{ id: report.id }}
      aria-label={`${dateLabel} ${kindLabel} ${status}`}
      className="inline-flex rounded-lg px-2 py-1 text-body-sm text-foreground no-underline transition-colors duration-200 hover:bg-muted"
    >
      {status}
    </Link>
  );
}
