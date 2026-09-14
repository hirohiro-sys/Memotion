import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { fetchMe } from "@/lib/api";

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
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
