import { useQuery } from "@tanstack/react-query";
import { CloudOff, NotebookPen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnlineStatus } from "@/features/memos/offline/use-online-status";
import { formatScheduleDate } from "@/features/schedule/jst";
import { fetchDailyReports } from "../api/get-daily-reports";
import { groupDailyReportsByDate } from "../group-by-date";
import { DailyReportSlot } from "./daily-report-slot";

export function DailyReportList() {
  const online = useOnlineStatus();
  const reportsQuery = useQuery({
    queryKey: ["daily-reports"],
    queryFn: fetchDailyReports,
  });
  const offline =
    !online ||
    (reportsQuery.data === undefined && reportsQuery.fetchStatus === "paused");
  const rows = reportsQuery.data
    ? groupDailyReportsByDate(reportsQuery.data.reports)
    : [];

  return (
    <div className="mx-auto max-w-[1440px] p-4 md:p-8">
      {offline && !reportsQuery.data ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-body-sm text-stone">
          <CloudOff className="size-4 shrink-0" />
          オフラインのため日報は表示できません
        </p>
      ) : null}

      {reportsQuery.isPending && !offline ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {reportsQuery.isError ? (
        <p className="py-20 text-center text-body-sm text-destructive">
          日報の取得に失敗しました
        </p>
      ) : null}

      {reportsQuery.isSuccess ? (
        <>
          <p className="mb-4 text-body-sm text-stone">
            今日の生成はあと {reportsQuery.data.remainingGenerations} 回
          </p>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
              <NotebookPen className="mx-auto mb-3 size-5 text-stone" />
              <p className="text-body-sm text-stone">日報はまだありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-border">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-caption font-medium text-stone"
                    >
                      日付
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-caption font-medium text-stone"
                    >
                      仕事
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-caption font-medium text-stone"
                    >
                      個人
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const dateLabel = formatScheduleDate(row.reportDate);
                    return (
                      <tr key={row.reportDate}>
                        <th
                          scope="row"
                          className="whitespace-nowrap px-4 py-3 text-body-sm font-medium text-foreground"
                        >
                          {dateLabel}
                        </th>
                        <td className="px-4 py-3">
                          <DailyReportSlot
                            report={row.work}
                            dateLabel={dateLabel}
                            kindLabel="仕事"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <DailyReportSlot
                            report={row.personal}
                            dateLabel={dateLabel}
                            kindLabel="個人"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
