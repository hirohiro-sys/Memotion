import type { Memo } from "@repo/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
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
import { useOnlineStatus } from "@/features/memos/offline/use-online-status";
import { SetScheduleError, setSchedule } from "../api/set-schedule";
import { jstToday } from "../jst";
import {
  pastDateError,
  type ScheduleDraft,
  ScheduleFields,
} from "./schedule-fields";

// 日付の初期値は、元の予定の日付が今日以降ならその日付、過去なら（予定でないときも）今日。
function initialDraft(
  scheduledDate: string | undefined,
  scheduledTime: string | undefined,
): ScheduleDraft {
  const today = jstToday(new Date());
  const date = scheduledDate && scheduledDate >= today ? scheduledDate : today;
  return { date, time: scheduledTime ?? "" };
}

// 「予定にする」と「日時を変更」で共用する、日付と時刻のダイアログ。
export function ScheduleDialog({
  memo,
  open,
  onOpenChange,
}: {
  memo: Memo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const online = useOnlineStatus();
  const converting = memo.tag !== "schedule";
  const { scheduledDate, scheduledTime } = memo;
  const [draft, setDraft] = useState<ScheduleDraft>(() =>
    initialDraft(scheduledDate, scheduledTime),
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 開いたときに初期値へ戻す。一覧の取り直しで memo が作り直されても、入力中の値は消さない。
  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft(scheduledDate, scheduledTime));
    setServerError(null);
  }, [open, scheduledDate, scheduledTime]);

  const pastError = pastDateError(draft, new Date());
  const canSubmit =
    draft.date !== "" && pastError === null && online && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await setSchedule(memo.id, {
        scheduledDate: draft.date,
        scheduledTime: draft.time === "" ? null : draft.time,
      });
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof SetScheduleError) {
        if (error.code === "schedule_date_past") {
          setServerError("過去の日付は選べません");
          return;
        }
        if (error.status === 401) {
          await router.invalidate();
          return;
        }
        if (error.code === "not_schedulable" || error.status === 404) {
          toast.add({
            title: "このメモは予定にできません。",
            type: "error",
          });
          onOpenChange(false);
          await queryClient.invalidateQueries({ queryKey: ["memos"] });
          return;
        }
      }
      toast.add({ title: "保存できませんでした。", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogTitle>
            {converting ? "予定にする" : "日時を変更"}
          </AlertDialogTitle>
          <AlertDialogDescription className="mb-4">
            {converting
              ? "日付は必須、時刻は任意です。予定からつぶやきには戻せません。"
              : "日付は必須、時刻は任意です。"}
          </AlertDialogDescription>
          <ScheduleFields
            value={draft}
            onChange={(next) => {
              setDraft(next);
              setServerError(null);
            }}
            disabled={submitting || !online}
            error={serverError ?? pastError}
          />
          {online ? null : (
            <p className="mb-2 text-caption text-stone">
              オフラインのため保存できません
            </p>
          )}
          <AlertDialogFooter className="mt-4">
            <AlertDialogClose
              render={<Button type="button" variant="ghost" size="sm" />}
              disabled={submitting}
            >
              キャンセル
            </AlertDialogClose>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {converting ? "予定にする" : "保存"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
