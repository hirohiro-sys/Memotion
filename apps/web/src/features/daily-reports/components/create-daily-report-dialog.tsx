import type { DailyReportFramework, DailyReportKind, Memo } from "@repo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { jstDateOf, jstToday } from "@/features/schedule/jst";
import { createDailyReport } from "../api/create-daily-report";
import {
  DailyReportExistsError,
  dailyReportErrorTitle,
} from "../api/http-error";
import { nextPendingStamp } from "../pending";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 focus:border-primary";

function initialReportDate(memos: readonly Memo[], now: Date): string {
  const dates = memos.map((memo) => jstDateOf(memo.createdAt));
  const first = dates[0];
  if (first && dates.every((date) => date === first)) return first;
  return jstToday(now);
}

function frameworkFor(kind: DailyReportKind): DailyReportFramework {
  return kind === "work" ? "achievement" : "log";
}

export function CreateDailyReportDialog({
  open,
  onOpenChange,
  memos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memos: Memo[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const memosRef = useRef(memos);
  memosRef.current = memos;
  const [reportDate, setReportDate] = useState("");
  const [kind, setKind] = useState<DailyReportKind>("work");
  const [framework, setFramework] =
    useState<DailyReportFramework>("achievement");
  const [frameworkTouched, setFrameworkTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReportDate(initialReportDate(memosRef.current, new Date()));
    setKind("work");
    setFramework("achievement");
    setFrameworkTouched(false);
  }, [open]);

  const memoIds = memos.map((memo) => memo.id);
  const createMutation = useMutation({
    mutationFn: () =>
      createDailyReport({ reportDate, kind, framework, memoIds }),
    onSuccess: async (report) => {
      await queryClient.invalidateQueries({ queryKey: ["daily-reports"] });
      await navigate({
        to: "/daily-reports/$id",
        params: { id: report.id },
        state: { pendingMemoIds: memoIds, pendingStamp: nextPendingStamp() },
      });
    },
    onError: async (error) => {
      if (error instanceof DailyReportExistsError) {
        await queryClient.invalidateQueries({ queryKey: ["daily-reports"] });
        await navigate({
          to: "/daily-reports/$id",
          params: { id: error.dailyReportId },
          state: {
            pendingMemoIds: memoIds,
            pendingStamp: nextPendingStamp(),
          },
        });
        return;
      }
      toast.add({
        title: dailyReportErrorTitle(error, "日報を作れませんでした。"),
        type: "error",
      });
    },
  });

  const pending = createMutation.isPending;
  const canCreate = reportDate.length > 0 && memoIds.length > 0 && !pending;

  function changeKind(next: DailyReportKind) {
    setKind(next);
    if (!frameworkTouched) setFramework(frameworkFor(next));
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogTitle>日報を追加</AlertDialogTitle>
        <AlertDialogDescription>
          選んだメモから下書きを作ります。
        </AlertDialogDescription>
        <ul className="mb-4 max-h-36 space-y-2 overflow-y-auto">
          {memos.map((memo) => (
            <li key={memo.id} className="truncate text-body-sm text-foreground">
              {memo.content}
            </li>
          ))}
        </ul>
        <label
          className="mb-1 block text-caption text-stone"
          htmlFor="daily-report-date"
        >
          日付
        </label>
        <input
          id="daily-report-date"
          type="date"
          value={reportDate}
          disabled={pending}
          onChange={(event) => setReportDate(event.target.value)}
          className={fieldClass}
        />
        <label
          className="mt-4 mb-1 block text-caption text-stone"
          htmlFor="daily-report-kind"
        >
          種類
        </label>
        <select
          id="daily-report-kind"
          value={kind}
          disabled={pending}
          onChange={(event) =>
            changeKind(event.target.value as DailyReportKind)
          }
          className={fieldClass}
        >
          <option value="work">仕事</option>
          <option value="personal">個人</option>
        </select>
        <label
          className="mt-4 mb-1 block text-caption text-stone"
          htmlFor="daily-report-create-framework"
        >
          構成
        </label>
        <select
          id="daily-report-create-framework"
          value={framework}
          disabled={pending}
          onChange={(event) => {
            setFrameworkTouched(true);
            setFramework(event.target.value as DailyReportFramework);
          }}
          className={fieldClass}
        >
          <option value="achievement">実績</option>
          <option value="log">記録</option>
        </select>
        <AlertDialogFooter className="mt-6">
          <AlertDialogClose
            render={<Button type="button" variant="ghost" size="sm" />}
            disabled={pending}
          >
            キャンセル
          </AlertDialogClose>
          <Button
            type="button"
            size="sm"
            disabled={!canCreate}
            aria-busy={pending}
            onClick={() => createMutation.mutate()}
          >
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : null}
            作成
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
