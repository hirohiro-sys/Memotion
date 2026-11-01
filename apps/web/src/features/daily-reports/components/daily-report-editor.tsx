import {
  type DailyReportFramework,
  type DailyReportStatus,
  MAX_DAILY_REPORT_BODY,
} from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CloudOff, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useOnlineStatus } from "@/features/memos/offline/use-online-status";
import { appendDailyReport } from "../api/append-daily-report";
import { deleteDailyReport } from "../api/delete-daily-report";
import { fetchDailyReport } from "../api/get-daily-report";
import { DailyReportHttpError, dailyReportErrorTitle } from "../api/http-error";
import { updateDailyReport } from "../api/update-daily-report";
import { dailyReportHeading } from "../heading";
import { isPendingStampLive } from "../pending";

const STATUS_LABEL: Record<DailyReportStatus, string> = {
  draft: "下書き",
  confirmed: "確定",
};

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 focus:border-primary";

export function DailyReportEditor({ id }: { id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const reportQuery = useQuery({
    queryKey: ["daily-reports", id],
    queryFn: () => fetchDailyReport(id),
  });
  const report = reportQuery.data;
  const [body, setBody] = useState("");
  const [framework, setFramework] = useState<DailyReportFramework>("log");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingMemoIds = useRouterState({
    select: (state) => state.location.state.pendingMemoIds,
  });
  const pendingStamp = useRouterState({
    select: (state) => state.location.state.pendingStamp,
  });

  if (report && report.id !== loadedId) {
    setBody(report.body);
    setFramework(report.framework);
    setLoadedId(report.id);
  }

  const offline =
    !online ||
    (reportQuery.data === undefined && reportQuery.fetchStatus === "paused");
  const missing =
    reportQuery.error instanceof DailyReportHttpError &&
    reportQuery.error.status === 404;
  const trimmed = body.trim();
  const canSave =
    online && trimmed.length > 0 && trimmed.length <= MAX_DAILY_REPORT_BODY;
  const bodyDirty = report ? body !== report.body : false;
  const pendingIds =
    report && isPendingStampLive(pendingStamp)
      ? (pendingMemoIds ?? []).filter(
          (memoId) => !report.memoIds.includes(memoId),
        )
      : [];
  const canGenerate = online && !bodyDirty && !offline;

  const saveMutation = useMutation({
    mutationFn: (status: DailyReportStatus) =>
      updateDailyReport(id, { body, status, framework }),
    onSuccess: async (saved, status) => {
      setBody(saved.body);
      setFramework(saved.framework);
      queryClient.setQueryData(["daily-reports", id], saved);
      toast.add({ title: "保存しました。", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["daily-reports"] });
      if (status === "confirmed") await navigate({ to: "/daily-reports" });
    },
    onError: () => {
      toast.add({ title: "保存できませんでした。", type: "error" });
    },
  });

  function applySaved(saved: {
    body: string;
    framework: DailyReportFramework;
  }) {
    setBody(saved.body);
    setFramework(saved.framework);
  }

  const appendMutation = useMutation({
    mutationFn: () => appendDailyReport(id, { framework, memoIds: pendingIds }),
    onSuccess: async (saved) => {
      applySaved(saved);
      queryClient.setQueryData(["daily-reports", id], saved);
      toast.add({ title: "メモを足しました。", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["daily-reports"] });
    },
    onError: (error) => {
      toast.add({
        title: dailyReportErrorTitle(error, "メモを足せませんでした。"),
        type: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDailyReport(id),
    onSuccess: async () => {
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["daily-reports"] });
      await navigate({ to: "/daily-reports" });
    },
    onError: () => {
      toast.add({ title: "削除できませんでした。", type: "error" });
    },
  });

  const deletePending = deleteMutation.isPending;
  useEffect(() => {
    if (!online && !deletePending) setConfirmOpen(false);
  }, [online, deletePending]);

  const busy =
    saveMutation.isPending ||
    deleteMutation.isPending ||
    appendMutation.isPending;

  return (
    <div className="mx-auto max-w-[1440px] p-4 md:p-8">
      <Link
        to="/daily-reports"
        className="mb-4 inline-block text-caption text-stone no-underline hover:text-foreground"
      >
        日報一覧
      </Link>

      {offline ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-body-sm text-stone">
          <CloudOff className="size-4 shrink-0" />
          オフラインのため保存できません
        </p>
      ) : null}

      {reportQuery.isPending && !offline ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {missing ? (
        <p className="py-20 text-center text-body-sm text-stone">
          日報が見つかりません
        </p>
      ) : null}

      {reportQuery.isError && !missing ? (
        <p className="py-20 text-center text-body-sm text-destructive">
          日報の取得に失敗しました
        </p>
      ) : null}

      {report ? (
        <div className="rounded-xl border border-border bg-card px-4 py-4 md:px-6">
          <h1 className="text-body font-medium text-foreground">
            {dailyReportHeading(report)}
          </h1>
          <p className="mt-1 text-caption text-stone">
            {STATUS_LABEL[report.status]}
          </p>

          <label
            className="mt-6 mb-1 block text-caption text-stone"
            htmlFor="daily-report-framework"
          >
            構成
          </label>
          <select
            id="daily-report-framework"
            value={framework}
            disabled={!online || busy}
            onChange={(event) =>
              setFramework(event.target.value as DailyReportFramework)
            }
            className={fieldClass}
          >
            <option value="log">記録</option>
            <option value="achievement">実績</option>
          </select>

          <label
            className="mt-4 mb-1 block text-caption text-stone"
            htmlFor="daily-report-body"
          >
            本文
          </label>
          <textarea
            id="daily-report-body"
            value={body}
            rows={16}
            disabled={!online || busy}
            onChange={(event) => setBody(event.target.value)}
            className={`${fieldClass} resize-y`}
          />
          {trimmed.length > MAX_DAILY_REPORT_BODY ? (
            <p className="mt-1 text-caption text-destructive">
              本文は{MAX_DAILY_REPORT_BODY}文字までです
            </p>
          ) : null}

          {pendingIds.length > 0 ? (
            <p className="mt-4 text-body-sm text-stone">
              まだ入っていないメモが{pendingIds.length}件あります。
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={!online || busy}
              onClick={() => setConfirmOpen(true)}
            >
              削除
            </Button>
            {pendingIds.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={!canGenerate || busy}
                title={bodyDirty ? "保存していない本文があります" : undefined}
                onClick={() => appendMutation.mutate()}
                aria-busy={appendMutation.isPending}
              >
                {appendMutation.isPending ? (
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                ) : null}
                足す
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={!canSave || busy}
              onClick={() => saveMutation.mutate("draft")}
            >
              一時保存
            </Button>
            <Button
              type="button"
              disabled={!canSave || busy}
              onClick={() => saveMutation.mutate("confirmed")}
            >
              確定
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!deletePending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>この日報を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            日報だけを消します。メモは残ります。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button type="button" variant="ghost" size="sm" />}
              disabled={deletePending}
            >
              キャンセル
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deletePending}
              onClick={() => deleteMutation.mutate()}
            >
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
