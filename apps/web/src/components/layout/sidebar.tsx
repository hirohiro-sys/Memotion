import { Link, useRouterState } from "@tanstack/react-router";
import { Inbox, Moon, Settings2, Sun, User, X } from "lucide-react";
import { useState } from "react";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Skeleton } from "@/components/ui/skeleton";
import { applyTheme, getStoredTheme } from "@/config/theme";
import { cn } from "@/utils/cn";

const NAV_ITEMS = [
  { to: "/", label: "メモ一覧", icon: Inbox, exact: true },
  { to: "/settings", label: "設定", icon: Settings2, exact: false },
] as const;

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

export function Sidebar({
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [theme, setTheme] = useState<"light" | "dark">(getStoredTheme);
  const dark = theme === "dark";

  function handleTheme() {
    const next = dark ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const nav = (
    <>
      <div className="px-5 py-5">
        <BrandLockup />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const badge = item.to === "/" ? memoCount : 0;
            const isActive = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                onClick={onCloseMobile}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-lg px-4 py-3 text-body-sm no-underline transition-colors duration-200",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-foreground/50 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.to === "/" && memosPending ? (
                  <Skeleton className="h-3 w-4" />
                ) : (
                  badge > 0 && (
                    <span className="text-caption tabular-nums text-stone">
                      {badge}
                    </span>
                  )
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mx-3 mb-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
        <NotifyWidget
          title="今週の技術"
          count={techCount}
          notifyOn={notifyOn}
          cadence="週次通知"
          pending={memosPending || notificationsPending}
          onNavigate={onCloseMobile}
        />
        <NotifyWidget
          title="やること"
          count={todoCount}
          notifyOn={todoNotifyOn}
          cadence="毎日通知"
          pending={memosPending || notificationsPending}
          onNavigate={onCloseMobile}
        />
      </div>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2 px-1.5 py-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sky-tint text-primary">
            <User className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption text-foreground/95">
              ログイン中
            </p>
          </div>
          <button
            type="button"
            onClick={handleTheme}
            aria-pressed={dark}
            aria-label={
              dark ? "ライトモードに切り替える" : "ダークモードに切り替える"
            }
            className="rounded-lg p-1.5 text-stone transition-colors duration-200 hover:bg-muted hover:text-foreground"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="sticky top-0 z-20 hidden h-screen w-[260px] shrink-0 flex-col border-r border-border bg-card md:flex">
        {nav}
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
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
