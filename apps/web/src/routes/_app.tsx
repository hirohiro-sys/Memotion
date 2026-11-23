import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/app-header";
import { fetchMe, SessionCheckNetworkError } from "@/features/auth/api/get-me";
import { getStoredUserId } from "@/features/auth/stored-user-id";
import { discardOtherUsersItems } from "@/features/memos/offline/outbox";
import { useOutboxSync } from "@/features/memos/offline/use-outbox-sync";

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
  useOutboxSync();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
