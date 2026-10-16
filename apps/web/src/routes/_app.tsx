import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import {
  getStoredSidebarCollapsed,
  setStoredSidebarCollapsed,
} from "@/config/sidebar";
import { fetchMe, SessionCheckNetworkError } from "@/features/auth/api/get-me";
import { getStoredUserId } from "@/features/auth/stored-user-id";
import { fetchMemos } from "@/features/memos/api/get-memos";
import { discardOtherUsersItems } from "@/features/memos/offline/outbox";
import { useOnlineStatus } from "@/features/memos/offline/use-online-status";
import { useOutboxSync } from "@/features/memos/offline/use-outbox-sync";
import { fetchNotifications } from "@/features/notifications/api/get-notifications";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    let user: Awaited<ReturnType<typeof fetchMe>>;
    try {
      user = await fetchMe();
    } catch (error) {
      // サーバーに届かないときだけ、前回ログインした端末として通す（5xx は通さない）。
      if (error instanceof SessionCheckNetworkError && getStoredUserId()) {
        return;
      }
      if (error instanceof SessionCheckNetworkError) {
        throw redirect({ to: "/login" });
      }
      throw error;
    }
    if (!user) {
      throw redirect({ to: "/login" });
    }
    // 別のユーザーが前に残した未送信メモは、送らずに破棄する。
    // IndexedDB の応答を待って画面が止まらないよう、待たずに進める。
    void discardOtherUsersItems(user.id).catch(() => undefined);
  },
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getStoredSidebarCollapsed);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      setStoredSidebarCollapsed(next);
      return next;
    });
  }
  useOutboxSync();
  const memos = useQuery({ queryKey: ["memos"], queryFn: fetchMemos });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });
  const online = useOnlineStatus();
  // オフライン（ブラウザが圏外と判断している、またはデータが無いまま取得が止まっている）。
  // 圏外では、前に取得した古い件数を出さない。
  const memosOffline =
    !online || (memos.data === undefined && memos.fetchStatus === "paused");
  const notificationsOffline =
    !online ||
    (notifications.data === undefined &&
      notifications.fetchStatus === "paused");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        memoCount={memos.data?.items.length ?? 0}
        techCount={
          memos.data?.items.filter((memo) => memo.tag === "tech").length ?? 0
        }
        todoCount={
          memos.data?.items.filter((memo) => memo.tag === "todo").length ?? 0
        }
        memosPending={memos.isPending && !memosOffline}
        memosOffline={memosOffline}
        notifyOn={notifications.data?.techWeeklyEnabled ?? false}
        todoNotifyOn={notifications.data?.todoDailyEnabled ?? false}
        notificationsPending={notifications.isPending && !notificationsOffline}
        notificationsOffline={notificationsOffline}
      />
      <div className="min-w-0 flex-1">
        <TopBar pathname={pathname} onMenuClick={() => setMobileOpen(true)} />
        <main className="min-h-[calc(100vh-56px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
