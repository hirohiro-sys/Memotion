import type { Memo } from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { deleteMemos } from "@/features/memos/api/delete-memos";
import { fetchMemos } from "@/features/memos/api/get-memos";
import { useOnlineStatus } from "@/features/memos/offline/use-online-status";
import { groupMemosByCreatedDate } from "../day-memos";
import { groupSchedulesByDate, type ScheduleMemo } from "../day-schedule";
import { jstToday, parseDate } from "../jst";
import { shiftMonth } from "../month-grid";
import { DayMemoList } from "./day-memo-list";
import { DaySchedulePanel } from "./day-schedule-list";
import { MonthGrid } from "./month-grid";

const NO_SCHEDULES: ScheduleMemo[] = [];
const NO_MEMOS: Memo[] = [];

// 予定のカレンダー。メモ一覧の取得から予定を選んで表示する（専用の取得 API は無い）。
// 月と選んだ日は画面の状態だけで持つ。再読み込みすると今日に戻る。
export function CalendarView() {
  const queryClient = useQueryClient();
  const memosQuery = useQuery({ queryKey: ["memos"], queryFn: fetchMemos });
  const today = jstToday(new Date());
  const [selected, setSelected] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const { year, month } = parseDate(today);
    return { year, month };
  });
  const [deleting, setDeleting] = useState<ScheduleMemo | null>(null);
  const online = useOnlineStatus();

  const byDate = useMemo(
    () => groupSchedulesByDate(memosQuery.data?.items ?? []),
    [memosQuery.data],
  );
  const scheduledDates = useMemo(() => new Set(byDate.keys()), [byDate]);
  const memosByDate = useMemo(
    () => groupMemosByCreatedDate(memosQuery.data?.items ?? []),
    [memosQuery.data],
  );

  const deleteMutation = useMutation({
    mutationFn: (memo: ScheduleMemo) => deleteMemos([memo.id]),
    onSuccess: async () => {
      setDeleting(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["memos"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: async () => {
      setDeleting(null);
      toast.add({ title: "削除できませんでした。", type: "error" });
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
    },
  });

  // オフラインでは削除が待機したまま閉じられなくなるので、確認を閉じる。
  const deletePending = deleteMutation.isPending;
  useEffect(() => {
    if (!online && !deletePending) setDeleting(null);
  }, [online, deletePending]);

  function select(date: string) {
    setSelected(date);
    const { year, month } = parseDate(date);
    setVisibleMonth({ year, month });
  }

  // オフラインで取得が止まっている（データが無いまま待機中）。点が無いだけの月と区別して出す。
  const offline =
    memosQuery.data === undefined && memosQuery.fetchStatus === "paused";

  return (
    <div className="mx-auto max-w-[1440px] p-4 md:p-8">
      {offline ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-body-sm text-stone">
          <CloudOff className="size-4 shrink-0" />
          オフラインのため予定は表示できません
        </p>
      ) : null}
      {memosQuery.isError ? (
        <p className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-body-sm text-destructive">
          予定の取得に失敗しました
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <MonthGrid
          year={visibleMonth.year}
          month={visibleMonth.month}
          today={today}
          selected={selected}
          scheduledDates={scheduledDates}
          onSelect={select}
          onShiftMonth={(delta) =>
            setVisibleMonth((current) =>
              shiftMonth(current.year, current.month, delta),
            )
          }
          onToday={() => select(today)}
        />
        {memosQuery.data !== undefined ? (
          <DaySchedulePanel
            date={selected}
            schedules={byDate.get(selected) ?? NO_SCHEDULES}
            busy={deleteMutation.isPending}
            onDelete={setDeleting}
          >
            <DayMemoList memos={memosByDate.get(selected) ?? NO_MEMOS} />
          </DaySchedulePanel>
        ) : memosQuery.isPending && !offline ? (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 md:p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </section>
        ) : null}
      </div>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>この予定を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            削除した予定は元に戻せません。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button type="button" variant="ghost" size="sm" />}
              disabled={deleteMutation.isPending}
            >
              キャンセル
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending || !online}
              onClick={() => {
                if (deleting) deleteMutation.mutate(deleting);
              }}
            >
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
