import { Link, useRouterState } from "@tanstack/react-router";
import {
  Inbox,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sun,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Skeleton } from "@/components/ui/skeleton";
import { applyTheme, getStoredTheme } from "@/config/theme";
import { cn } from "@/utils/cn";

const NAV_ITEMS = [
  { to: "/", label: "メモ一覧", icon: Inbox, exact: true },
  { to: "/settings", label: "設定", icon: Settings2, exact: false },
] as const;

const iconButtonClass =
  "rounded-lg p-1.5 text-stone transition-colors duration-200 hover:bg-muted hover:text-foreground";

function NotifyWidget({
  title,
  count,
  notifyOn,
  cadence,
  pending,
  onNavigate,
}: {
  title: string;
  count: number;
  notifyOn: boolean;
  cadence: string;
  pending: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to="/settings"
      onClick={onNavigate}
      className="block px-3 py-3 no-underline transition-colors duration-200 hover:bg-muted"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-body-sm font-medium text-foreground">{title}</p>
        {pending ? (
          <Skeleton className="h-4 w-8" />
        ) : (
          <p className="text-body-sm font-medium tabular-nums text-foreground">
            {count}件
          </p>
        )}
      </div>
      {pending ? null : (
        <p className="mt-0.5 text-caption text-stone">
          {notifyOn ? `${cadence}オン` : `${cadence}オフ`}
        </p>
      )}
    </Link>
  );
}

function SidebarColumn({
  compact,
  onToggleCompact,
  onNavigate,
  memoCount,
  techCount,
  todoCount,
  memosPending,
  notifyOn,
  todoNotifyOn,
  notificationsPending,
  dark,
  onTheme,
}: {
  compact: boolean;
  onToggleCompact?: () => void;
  onNavigate: () => void;
  memoCount: number;
  techCount: number;
  todoCount: number;
  memosPending: boolean;
  notifyOn: boolean;
  todoNotifyOn: boolean;
  notificationsPending: boolean;
  dark: boolean;
  onTheme: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const summaryPending = memosPending || notificationsPending;

  return (
    <>
      <div
        className={cn(compact ? "flex justify-center px-2 py-4" : "px-5 py-5")}
      >
        <BrandLockup markOnly={compact} />
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
              isMemo && !memosPending
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
                {!compact && isMemo && !memosPending && memoCount > 0 ? (
                  <span className="text-caption tabular-nums text-stone">
                    {memoCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {onToggleCompact ? (
        <div
          className={cn(
            "flex",
            compact ? "justify-center px-2 pb-2" : "mx-3 mb-2 justify-end",
          )}
        >
          <button
            type="button"
            onClick={onToggleCompact}
            aria-pressed={compact}
            aria-label={compact ? "サイドバーを広げる" : "サイドバーを畳む"}
            title={compact ? "サイドバーを広げる" : "サイドバーを畳む"}
            className={cn(
              iconButtonClass,
              compact && "flex size-10 items-center justify-center p-0",
            )}
          >
            {compact ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>
      ) : null}

      {compact ? null : (
        <div className="mx-3 mb-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
          <NotifyWidget
            title="今週の技術"
            count={techCount}
            notifyOn={notifyOn}
            cadence="週次通知"
            pending={summaryPending}
            onNavigate={onNavigate}
          />
          <NotifyWidget
            title="やること"
            count={todoCount}
            notifyOn={todoNotifyOn}
            cadence="毎日通知"
            pending={summaryPending}
            onNavigate={onNavigate}
          />
        </div>
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
  techCount,
  todoCount,
  memosPending,
  notifyOn,
  todoNotifyOn,
  notificationsPending,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  memoCount: number;
  techCount: number;
  todoCount: number;
  memosPending: boolean;
  notifyOn: boolean;
  todoNotifyOn: boolean;
  notificationsPending: boolean;
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
    techCount,
    todoCount,
    memosPending,
    notifyOn,
    todoNotifyOn,
    notificationsPending,
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
