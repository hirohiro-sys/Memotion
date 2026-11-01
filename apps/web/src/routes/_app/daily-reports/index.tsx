import { createFileRoute } from "@tanstack/react-router";
import { DailyReportList } from "@/features/daily-reports/components/daily-report-list";

export const Route = createFileRoute("/_app/daily-reports/")({
  component: DailyReportList,
});
