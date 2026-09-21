import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
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
import { cn } from "@/utils/cn";

const NAV_ITEMS = [
  { to: "/", label: "メモ一覧", icon: Inbox, exact: true },
  { to: "/settings", label: "設定", icon: Settings2, exact: false },
] as const;

const NOTIFY_TONE = {
  tech: {
    wash: "bg-sky-tint hover:bg-sky-tint/80",
    title: "text-primary",
    bellOn: "text-primary",
  },
  todo: {
    wash: "bg-marigold/20 hover:bg-marigold/30",
    title: "text-saffron",
    bellOn: "text-saffron",
  },
} as const;

function NotifyWidget({
  tone,
  title,
  count,
  notifyOn,
  cadence,
  pending,
  onNavigate,
}: {
  tone: keyof typeof NOTIFY_TONE;
  title: string;
  count: number;
  notifyOn: boolean;
  cadence: string;
  pending: boolean;
  onNavigate: () => void;
}) {
  const colors = NOTIFY_TONE[tone];

  return (
    <Link
      to="/settings"
      onClick={onNavigate}
      className={cn(
        "block p-3 no-underline transition-colors duration-200",
        colors.wash,
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className={cn("text-caption font-medium", colors.title)}>{title}</p>
        {notifyOn ? (
          <Bell className={cn("size-3.5", colors.bellOn)} />
        ) : (
          <BellOff className="size-3.5 text-stone" />
        )}
      </div>
      {pending ? (
        <Skeleton className="h-5 w-12" />
      ) : (
        <>
          <p className="text-body font-semibold tabular-nums text-foreground">
            {count}
            <span className="ml-0.5 text-caption font-medium text-stone">
              件
            </span>
          </p>
          <p className="mt-1 text-caption text-graphite">
            {notifyOn ? `${cadence}オン` : `${cadence}オフ`}
          </p>
        </>
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

      <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-border">
        <NotifyWidget
          tone="tech"
          title="今週の技術"
          count={techCount}
          notifyOn={notifyOn}
          cadence="週次通知"
          pending={memosPending || notificationsPending}
          onNavigate={onCloseMobile}
        />
        <NotifyWidget
          tone="todo"
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
