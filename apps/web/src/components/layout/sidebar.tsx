import type { NotificationSettings } from "@repo/shared";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Inbox,
  Moon,
  Settings2,
  Sun,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Skeleton } from "@/components/ui/skeleton";
import { applyTheme, getStoredTheme } from "@/config/theme";
import {
  formatMonthDay,
  nextDailyDate,
  nextWeeklyDate,
} from "@/features/notifications/next-notice";
import { cn } from "@/utils/cn";

const NAV_ITEMS = [
  { to: "/", label: "メモ一覧", icon: Inbox, exact: true },
  { to: "/calendar", label: "カレンダー", icon: CalendarDays, exact: false },
  { to: "/settings", label: "設定", icon: Settings2, exact: false },
] as const;

const iconButtonClass =
  "rounded-lg p-1.5 text-stone transition-colors duration-200 hover:bg-muted hover:text-foreground";

function NotifyStatusRow({
  title,
  enabled,
  next,
  pending,
  unavailable,
  onNavigate,
}: {
  title: string;
  enabled: boolean;
  next: string;
  pending: boolean;
  unavailable: boolean;
  onNavigate: () => void;
}) {
  const on = enabled && !pending && !unavailable;
  return (
    <Link
      to="/settings"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 no-underline transition-colors duration-200 hover:bg-muted"
    >
      <CircleCheck
        className={cn("size-3.5 shrink-0", on ? "text-primary" : "text-stone")}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-caption",
            on ? "font-medium text-foreground" : "text-stone",
          )}
        >
          {title}
        </p>
        {pending ? (
          <Skeleton className="mt-0.5 h-2.5 w-14" />
        ) : (
          <p className="truncate text-[10px] text-stone">
            {unavailable ? "-" : enabled ? next : "無効"}
          </p>
        )}
      </div>
    </Link>
  );
}

// LINE 通知の状態。各通知のオン/オフと、次に届く日を出す。
function NotifyStatus({
  notifications,
  pending,
  unavailable,
  onNavigate,
}: {
  notifications: NotificationSettings | undefined;
  pending: boolean;
  unavailable: boolean;
  onNavigate: () => void;
}) {
  const now = new Date();
  const rowState = { pending, unavailable, onNavigate };
  return (
    <section className="border-t border-border px-3 pt-3 pb-3">
      <h2 className="mb-2 px-3 text-body-sm font-medium text-foreground">
        LINE通知ステータス
      </h2>
      <NotifyStatusRow
        title="週次Techまとめ"
        enabled={notifications?.techWeeklyEnabled ?? false}
        next={
          notifications
            ? `次回: ${formatMonthDay(
                nextWeeklyDate(
                  now,
                  notifications.techWeeklyDay,
                  notifications.techWeeklyTime,
                ),
              )}`
            : ""
        }
        {...rowState}
      />
      <NotifyStatusRow
        title="直近TODO"
        enabled={notifications?.todoDailyEnabled ?? false}
        next={
          notifications
            ? `次回: ${formatMonthDay(
                nextDailyDate(now, notifications.todoDailyTime),
              )}`
            : ""
        }
        {...rowState}
      />
      <NotifyStatusRow
        title="予定の前日通知"
        enabled={notifications?.scheduleDailyEnabled ?? false}
        // 予定がある日の前日だけ届くので、日付ではなく時刻を出す。
        next={notifications ? `前日 ${notifications.scheduleDailyTime}` : ""}
        {...rowState}
      />
    </section>
  );
}

function SidebarColumn({
  compact,
  onToggleCompact,
  onNavigate,
  memoCount,
  memosPending,
  memosOffline,
  notifications,
  notificationsPending,
  notificationsOffline,
  dark,
  onTheme,
}: {
  compact: boolean;
  onToggleCompact?: () => void;
  onNavigate: () => void;
  memoCount: number;
  memosPending: boolean;
  memosOffline: boolean;
  notifications: NotificationSettings | undefined;
  notificationsPending: boolean;
  notificationsOffline: boolean;
  dark: boolean;
  onTheme: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <div
        className={cn(
          "flex items-center",
          compact
            ? "flex-col justify-center gap-2 px-2 py-4"
            : "gap-1 px-3 py-5",
        )}
      >
        <BrandLockup markOnly={compact} />
        {onToggleCompact ? (
          <button
            type="button"
            onClick={onToggleCompact}
            aria-pressed={compact}
            aria-label={compact ? "サイドバーを広げる" : "サイドバーを畳む"}
            title={compact ? "サイドバーを広げる" : "サイドバーを畳む"}
            className={cn(
              iconButtonClass,
              "shrink-0",
              // 行ボックス中央だと小文字の字面より上に見える
              !compact && "translate-y-[3px]",
            )}
          >
            {compact ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        ) : null}
      </div>

      <nav
        className={cn("flex-1 overflow-y-auto py-3", compact ? "px-2" : "px-3")}
      >
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isMemo = item.to === "/";
            const isActive = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const compactLabel =
              isMemo && !memosPending && !memosOffline
                ? `${item.label}、${memoCount}件`
                : item.label;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                onClick={onNavigate}
                aria-label={compact ? compactLabel : undefined}
                title={compact ? compactLabel : undefined}
                className={cn(
                  "relative flex items-center rounded-lg text-body-sm no-underline transition-colors duration-200",
                  compact
                    ? "mx-auto size-10 justify-center"
                    : "w-full gap-2.5 px-4 py-3",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-foreground/50 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {compact ? null : (
                  <span className="flex-1 text-left">{item.label}</span>
                )}
                {!compact && isMemo && memosPending ? (
                  <Skeleton className="h-3 w-4" />
                ) : null}
                {!compact && isMemo && memosOffline ? (
                  <span className="text-caption tabular-nums text-stone">
                    -
                  </span>
                ) : null}
                {!compact &&
                isMemo &&
                !memosPending &&
                !memosOffline &&
                memoCount > 0 ? (
                  <span className="text-caption tabular-nums text-stone">
                    {memoCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {compact ? null : (
        <NotifyStatus
          notifications={notifications}
          pending={notificationsPending}
          unavailable={notificationsOffline}
          onNavigate={onNavigate}
        />
      )}

      <div
        className={cn("border-t border-border py-3", compact ? "px-2" : "px-3")}
      >
        <div
          className={cn(
            "flex items-center",
            compact ? "flex-col gap-1" : "gap-2 px-1.5 py-1",
          )}
        >
          <div
            className="flex size-8 items-center justify-center rounded-lg bg-sky-tint text-primary"
            title={compact ? "ログイン中" : undefined}
          >
            <User className="size-4" />
            {compact ? <span className="sr-only">ログイン中</span> : null}
          </div>
          {compact ? null : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption text-foreground/95">
                ログイン中
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onTheme}
            aria-pressed={dark}
            aria-label={
              dark ? "ライトモードに切り替える" : "ダークモードに切り替える"
            }
            className={iconButtonClass}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  memoCount,
  memosPending,
  memosOffline,
  notifications,
  notificationsPending,
  notificationsOffline,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  memoCount: number;
  memosPending: boolean;
  memosOffline: boolean;
  notifications: NotificationSettings | undefined;
  notificationsPending: boolean;
  notificationsOffline: boolean;
}) {
  const [theme, setTheme] = useState<"light" | "dark">(getStoredTheme);
  const dark = theme === "dark";

  function handleTheme() {
    const next = dark ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const columnProps = {
    onNavigate: onCloseMobile,
    memoCount,
    memosPending,
    memosOffline,
    notifications,
    notificationsPending,
    notificationsOffline,
    dark,
    onTheme: handleTheme,
  };

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 z-20 hidden h-screen shrink-0 flex-col overflow-x-hidden border-r border-border bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-[260px]",
        )}
      >
        <SidebarColumn
          compact={collapsed}
          onToggleCompact={onToggleCollapsed}
          {...columnProps}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/30"
            aria-label="メニューを閉じる"
            onClick={onCloseMobile}
          />
          <aside className="absolute top-0 bottom-0 left-0 flex w-[260px] flex-col bg-card">
            <button
              type="button"
              onClick={onCloseMobile}
              className="absolute top-4 right-3 rounded-lg p-1.5 text-stone transition-colors duration-200 hover:bg-muted hover:text-foreground"
              aria-label="閉じる"
            >
              <X className="size-4" />
            </button>
            <SidebarColumn compact={false} {...columnProps} />
          </aside>
        </div>
      )}
    </>
  );
}
