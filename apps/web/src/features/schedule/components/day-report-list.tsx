import type { DailyReportSummary } from "@repo/shared";
import { NotebookPen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyReportSlot } from "@/features/daily-reports/components/daily-report-slot";
import { groupDailyReportsByDate } from "@/features/daily-reports/group-by-date";
import { formatScheduleDate } from "@/features/schedule/jst";

// 選んだ日の日報。report_date が一致するものだけ。見るだけで、編集は日報のページで行う。
export function DayReportList({
  reports,
  known,
  pending,
  failed,
}: {
  reports: DailyReportSummary[];
  known: boolean;
  pending: boolean;
  failed: boolean;
}) {
  if (!known && !pending && !failed) return null;
  const row = groupDailyReportsByDate(reports)[0];
  const dateLabel = row ? formatScheduleDate(row.reportDate) : "";

  return (
    <div className="mt-6 border-t border-border pt-6">
      <h3 className="mb-4 text-body font-medium text-foreground">
        この日の日報
      </h3>
      {pending ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : null}
      {failed ? (
        <p className="text-body-sm text-destructive">
          日報の取得に失敗しました
        </p>
      ) : null}
      {known && !pending && !row ? (
        <div className="py-8 text-center">
          <NotebookPen className="mx-auto mb-2 size-5 text-stone" />
          <p className="text-body-sm text-stone">この日の日報はありません</p>
        </div>
      ) : null}
      {known && !pending && row ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-border">
              <tr>
                <th
                  scope="col"
                  className="px-2 py-2 text-caption font-medium text-stone"
                >
                  仕事
                </th>
                <th
                  scope="col"
                  className="px-2 py-2 text-caption font-medium text-stone"
                >
                  個人
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-3">
                  <DailyReportSlot
                    report={row.work}
                    dateLabel={dateLabel}
                    kindLabel="仕事"
                  />
                </td>
                <td className="px-2 py-3">
                  <DailyReportSlot
                    report={row.personal}
                    dateLabel={dateLabel}
                    kindLabel="個人"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
