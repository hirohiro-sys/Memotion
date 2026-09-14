import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, BellOff, Inbox, LogOut, Settings2, User, X } from "lucide-react";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMemos, fetchNotifications, logout } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "メモ一覧", icon: Inbox, exact: true },
  { to: "/settings", label: "設定", icon: Settings2, exact: false },
] as const;

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const memos = useQuery({ queryKey: ["memos"], queryFn: fetchMemos });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });

  const memoCount = memos.data?.items.length ?? 0;
  const techCount =
    memos.data?.items.filter((memo) => memo.tag === "tech").length ?? 0;
  const notifyOn = notifications.data?.techWeeklyEnabled ?? false;

  async function handleLogout() {
    await logout();
    await queryClient.clear();
    onCloseMobile();
    await navigate({ to: "/login" });
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
                {item.to === "/" && memos.isPending ? (
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

      <div className="px-3 pb-3">
        <Link
          to="/settings"
          onClick={onCloseMobile}
          className="block rounded-xl border border-border bg-sky-tint p-3 no-underline transition-colors duration-200 hover:bg-sky-tint/80"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-caption font-medium text-primary">今週の技術</p>
            {notifyOn ? (
              <Bell className="size-3.5 text-primary" />
            ) : (
              <BellOff className="size-3.5 text-stone" />
            )}
          </div>
          {memos.isPending || notifications.isPending ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <>
              <p className="text-body font-semibold tabular-nums text-foreground">
                {techCount}
                <span className="ml-0.5 text-caption font-medium text-stone">
                  件
                </span>
              </p>
              <p className="mt-1 text-caption text-graphite">
                {notifyOn ? "週次通知オン" : "週次通知オフ"}
              </p>
            </>
          )}
        </Link>
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
            onClick={() => void handleLogout()}
            className="rounded-lg p-1.5 text-stone transition-colors duration-200 hover:bg-muted hover:text-foreground"
            aria-label="ログアウト"
          >
            <LogOut className="size-4" />
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
