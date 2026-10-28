import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff, LogOut } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { ToggleSwitch } from "@/components/toggle-switch";
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
import { PILL_IDLE, WEEKDAYS } from "@/config/tag-meta";
import { ConnpassSettings } from "@/features/connpass/components/connpass-settings";
import { PwaInstallGuide } from "@/features/pwa/components/pwa-install-guide";
import { cn } from "@/utils/cn";
import { fetchNotifications } from "../api/get-notifications";
import { updateNotifications } from "../api/update-notifications";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// 入力の確定（フォーカスが外れたとき、Enter）でだけ送る時刻の欄。
// 予定の通知は時刻を変えると「処理済み」が進んで戻らないので、打ちかけの値（02:00 など）を送らない。
function CommitTimeInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: string;
  onCommit: (time: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit() {
    if (draft === value) return;
    if (!TIME_PATTERN.test(draft)) {
      setDraft(value);
      return;
    }
    onCommit(draft);
  }

  return (
    <input
      id={id}
      type="time"
      aria-label="時刻"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-center font-mono text-body-sm outline-none transition-colors duration-200 focus:border-primary"
    />
  );
}

function NotifyChannel({
  title,
  summary,
  checked,
  onCheckedChange,
  hint,
  warning,
  className,
  children,
}: {
  title: string;
  summary?: string;
  checked: boolean;
  onCheckedChange: (enabled: boolean) => void;
  hint?: string;
  warning?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body-sm text-foreground">{title}</p>
          {summary ? (
            <p className="mt-0.5 text-caption text-stone">{summary}</p>
          ) : null}
        </div>
        <ToggleSwitch checked={checked} onChange={onCheckedChange} />
      </div>
      {warning ? <p className="text-caption text-stone">{warning}</p> : null}
      {checked ? children : null}
      {checked && hint ? (
        <p className="text-caption text-stone">{hint}</p>
      ) : null}
    </div>
  );
}

export function SettingsView({
  onLogout,
  countUnsent,
}: {
  onLogout: () => Promise<void>;
  countUnsent: () => Promise<number>;
}) {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });
  const notifications = notificationsQuery.data;
  // オフラインで、データが無いまま取得が止まっている。
  const notificationsOffline =
    notifications === undefined && notificationsQuery.fetchStatus === "paused";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unsentCount, setUnsentCount] = useState(0);

  // 未送信のメモがあれば確認してから、無ければそのままログアウトする。
  async function requestLogout() {
    const count = await countUnsent();
    if (count > 0) {
      setUnsentCount(count);
      setConfirmOpen(true);
      return;
    }
    await handleLogout();
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  const notifyMutation = useMutation({
    mutationFn: updateNotifications,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-6 text-subheading font-bold text-foreground">通知</h3>

        {notificationsOffline && (
          <p className="flex items-center gap-2 text-body-sm text-stone">
            <CloudOff className="size-4 shrink-0" />
            オフラインのため設定を取得できません
          </p>
        )}

        {notificationsQuery.isPending && !notificationsOffline && (
          <div className="space-y-6" role="status" aria-label="読み込み中">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          </div>
        )}

        {notifications && (
          <div className="space-y-6">
            <NotifyChannel
              className="border-b border-border pb-6"
              title="技術の週次通知"
              summary={`次の通知に含まれるTech ${notifications.pendingCount}件`}
              checked={notifications.techWeeklyEnabled}
              onCheckedChange={(enabled) =>
                notifyMutation.mutate({ techWeeklyEnabled: enabled })
              }
              warning={notifications.disabledReason}
              hint={`対象がある週だけ、毎週${WEEKDAYS[notifications.techWeeklyDay]}曜日 ${notifications.techWeeklyTime} に届く`}
            >
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <p className="mb-1.5 text-caption text-stone">通知曜日</p>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          notifyMutation.mutate({ techWeeklyDay: index })
                        }
                        className={cn(
                          "inline-flex size-8 items-center justify-center rounded-full text-caption font-medium transition-colors duration-200",
                          notifications.techWeeklyDay === index
                            ? "bg-sky-tint text-primary"
                            : PILL_IDLE,
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-28">
                  <label
                    htmlFor="notify-time"
                    className="mb-1.5 block text-caption text-stone"
                  >
                    時刻
                  </label>
                  <input
                    id="notify-time"
                    type="time"
                    value={notifications.techWeeklyTime}
                    onChange={(event) =>
                      notifyMutation.mutate({
                        techWeeklyTime: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-center font-mono text-body-sm outline-none transition-colors duration-200 focus:border-primary"
                  />
                </div>
              </div>
            </NotifyChannel>

            <NotifyChannel
              title="TODOの毎日通知"
              summary={`次の通知に含まれるTODO ${notifications.todoPendingCount}件`}
              checked={notifications.todoDailyEnabled}
              onCheckedChange={(enabled) =>
                notifyMutation.mutate({ todoDailyEnabled: enabled })
              }
              warning={notifications.todoDisabledReason}
              hint={`残っているTODOがある日だけ、毎日 ${notifications.todoDailyTime} に届く`}
            >
              <div>
                <label
                  htmlFor="todo-notify-time"
                  className="mb-1.5 block text-caption text-stone"
                >
                  時刻
                </label>
                <input
                  id="todo-notify-time"
                  type="time"
                  value={notifications.todoDailyTime}
                  onChange={(event) =>
                    notifyMutation.mutate({
                      todoDailyTime: event.target.value,
                    })
                  }
                  className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-center font-mono text-body-sm outline-none transition-colors duration-200 focus:border-primary"
                />
              </div>
            </NotifyChannel>

            <NotifyChannel
              className="border-t border-border pt-6"
              title="予定の前日通知"
              checked={notifications.scheduleDailyEnabled}
              onCheckedChange={(enabled) =>
                notifyMutation.mutate({ scheduleDailyEnabled: enabled })
              }
              warning={notifications.scheduleDisabledReason}
              hint={`翌日に予定がある日だけ、前日の ${notifications.scheduleDailyTime} に届く。最初はオンで、オフにもできる。今日の通知時刻を過ぎてからオンにしたり時刻を変えたりした日は、明日の予定は通知されない`}
            >
              <div>
                <label
                  htmlFor="schedule-notify-time"
                  className="mb-1.5 block text-caption text-stone"
                >
                  時刻
                </label>
                <CommitTimeInput
                  id="schedule-notify-time"
                  value={notifications.scheduleDailyTime}
                  onCommit={(time) =>
                    notifyMutation.mutate({ scheduleDailyTime: time })
                  }
                />
              </div>
            </NotifyChannel>
          </div>
        )}
      </section>

      <ConnpassSettings />

      <PwaInstallGuide />

      <div className="flex justify-end">
        <Button
          type="button"
          variant="destructive"
          disabled={loggingOut}
          onClick={() => void requestLogout()}
        >
          <LogOut className="size-3.5" /> ログアウト
        </Button>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!loggingOut) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            未送信のメモが{unsentCount}件あります
          </AlertDialogTitle>
          <AlertDialogDescription>
            ログアウトすると、この端末の未送信のメモは破棄されます。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button type="button" variant="ghost" size="sm" />}
              disabled={loggingOut}
            >
              キャンセル
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              破棄してログアウト
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
