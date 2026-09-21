import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { ToggleSwitch } from "@/components/toggle-switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PILL_IDLE, WEEKDAYS } from "@/config/tag-meta";
import { cn } from "@/utils/cn";
import { fetchNotifications } from "../api/get-notifications";
import { updateNotifications } from "../api/update-notifications";

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
  summary: string;
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
          <p className="mt-0.5 text-caption text-stone">{summary}</p>
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

export function SettingsView({ onLogout }: { onLogout: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });
  const notifications = notificationsQuery.data;

  const notifyMutation = useMutation({
    mutationFn: updateNotifications,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-6 text-subheading font-bold text-foreground">
          通知
        </h3>

        {notificationsQuery.isPending && (
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
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="destructive"
          onClick={() => void onLogout()}
        >
          <LogOut className="size-3.5" /> ログアウト
        </Button>
      </div>
    </div>
  );
}
