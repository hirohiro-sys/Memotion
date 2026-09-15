import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { ToggleSwitch } from "@/components/toggle-switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchMemos,
  fetchNotifications,
  logout,
  updateNotifications,
} from "@/lib/api";
import { PILL_IDLE, TAG_META, TAG_ORDER, WEEKDAYS } from "@/lib/tag-meta";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const memosQuery = useQuery({ queryKey: ["memos"], queryFn: fetchMemos });
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });
  const [theme, setTheme] = useState<"light" | "dark">(getStoredTheme);

  const memos = memosQuery.data?.items ?? [];
  const notifications = notificationsQuery.data;

  const notifyMutation = useMutation({
    mutationFn: updateNotifications,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  function handleTheme(next: boolean) {
    const value = next ? "dark" : "light";
    setTheme(value);
    applyTheme(value);
  }

  async function handleLogout() {
    await logout();
    await queryClient.clear();
    await navigate({ to: "/login" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-1 text-body-sm font-medium text-foreground">通知</h3>
        <p className="mb-4 text-body-sm text-graphite">
          対象がある週だけ、その時刻に届く
        </p>

        {notificationsQuery.isPending && (
          <div
            className="space-y-4 border-t border-border pt-4"
            role="status"
            aria-label="読み込み中"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          </div>
        )}

        {notifications && (
          <div className="border-t border-border">
            <div className="flex items-start justify-between gap-3 py-4">
              <div>
                <p className="text-body-sm text-foreground">
                  技術の週次通知
                </p>
                <p className="mt-0.5 text-caption text-stone">
                  次の通知に含まれるTech {notifications.pendingCount}件
                </p>
              </div>
              <ToggleSwitch
                checked={notifications.techWeeklyEnabled}
                onChange={(enabled) =>
                  notifyMutation.mutate({ techWeeklyEnabled: enabled })
                }
              />
            </div>

            {notifications.disabledReason && (
              <p className="border-t border-border py-3 text-caption text-stone">
                {notifications.disabledReason}
              </p>
            )}

            {notifications.techWeeklyEnabled && (
              <div className="flex items-center gap-3 border-t border-border py-4">
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
            )}

            {notifications.techWeeklyEnabled && (
              <p className="border-t border-border py-3 text-caption text-stone">
                対象がある週だけ、毎週{WEEKDAYS[notifications.techWeeklyDay]}
                曜日 {notifications.techWeeklyTime} に届く
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-1 text-body-sm font-medium text-foreground">外観</h3>
        <p className="mb-4 text-body-sm text-graphite">
          ダークモードの切り替えができます。
        </p>
        <div className="flex items-center justify-between border-t border-border py-4">
          <div>
            <p className="text-body-sm text-foreground">ダークモード</p>
            <p className="text-caption text-stone">
              現在: {theme === "dark" ? "オン" : "オフ"}
            </p>
          </div>
          <ToggleSwitch checked={theme === "dark"} onChange={handleTheme} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-body-sm font-medium text-foreground">
          アカウント
        </h3>
        <div className="border-t border-border">
          <div className="flex items-center justify-between py-3">
            <span className="text-body-sm text-stone">メモ総数</span>
            {memosQuery.isPending ? (
              <Skeleton className="h-4 w-8" />
            ) : (
              <span className="text-body-sm tabular-nums text-foreground">
                {memos.length}件
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-end pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleLogout()}
            className="text-stone hover:text-destructive"
          >
            <LogOut className="size-3.5" /> ログアウト
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-1 text-body-sm font-medium text-foreground">タグ</h3>
        <p className="mb-4 text-body-sm text-graphite">
          LINE Botで使用する3つのタグです。
        </p>
        <div className="divide-y divide-border border-t border-border">
          {TAG_ORDER.map((tag) => {
            const meta = TAG_META[tag];
            const count = memos.filter((memo) => memo.tag === tag).length;
            return (
              <div key={tag} className="flex items-center gap-3 py-3">
                <span
                  className={cn("size-2.5 shrink-0 rounded-full", meta.className)}
                />
                <div className="flex-1">
                  <p className="text-body-sm text-foreground">
                    {meta.label}{" "}
                    <span className="font-mono text-caption text-stone">
                      {meta.hashtag}
                    </span>
                  </p>
                  <p className="text-caption text-stone">{meta.description}</p>
                </div>
                {memosQuery.isPending ? (
                  <Skeleton className="h-3 w-6" />
                ) : (
                  <span className="text-caption tabular-nums text-stone">
                    {count}件
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
