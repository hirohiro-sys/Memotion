import { createFileRoute } from "@tanstack/react-router";
import { DailyReportEditor } from "@/features/daily-reports/components/daily-report-editor";

export const Route = createFileRoute("/_app/daily-reports/$id")({
  component: DailyReportEditorPage,
});

function DailyReportEditorPage() {
  const { id } = Route.useParams();
  return <DailyReportEditor id={id} />;
}
