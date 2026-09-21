import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { fetchMe } from "@/features/auth/api/get-me";
import { logout } from "@/features/auth/api/logout";
import { fetchMemos } from "@/features/memos/api/get-memos";
import { fetchNotifications } from "@/features/notifications/api/get-notifications";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await fetchMe();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const memos = useQuery({ queryKey: ["memos"], queryFn: fetchMemos });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });

  async function handleLogout() {
    await logout();
    await queryClient.clear();
    await navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        memoCount={memos.data?.items.length ?? 0}
        techCount={
          memos.data?.items.filter((memo) => memo.tag === "tech").length ?? 0
        }
        todoCount={
          memos.data?.items.filter((memo) => memo.tag === "todo").length ?? 0
        }
        memosPending={memos.isPending}
        notifyOn={notifications.data?.techWeeklyEnabled ?? false}
        todoNotifyOn={notifications.data?.todoDailyEnabled ?? false}
        notificationsPending={notifications.isPending}
        onLogout={handleLogout}
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
