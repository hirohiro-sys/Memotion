import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "@/components/ui/toast";
import { logout } from "@/features/auth/api/logout";
import {
  clearStoredUserId,
  getStoredUserId,
} from "@/features/auth/stored-user-id";
import { clearOutbox, listOutboxItems } from "@/features/memos/offline/outbox";
import { SettingsView } from "@/features/notifications/components/settings-view";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ボタンを押した時点の件数を読む（画面の表示より前に押されても確認を出すため）。
  async function countUnsent(): Promise<number> {
    try {
      const userId = getStoredUserId();
      const items = await listOutboxItems();
      return items.filter((item) => item.userId === userId).length;
    } catch {
      return 0;
    }
  }

  // ログアウトが成功してから、未送信のメモと端末のユーザー ID を消す。
  // 失敗したら（オフラインを含む）どちらも残す。
  async function handleLogout() {
    try {
      await logout();
    } catch {
      toast.add({ title: "ログアウトできませんでした。", type: "error" });
      return;
    }
    await clearOutbox().catch(() => undefined);
    clearStoredUserId();
    await queryClient.clear();
    await navigate({ to: "/login" });
  }

  return <SettingsView onLogout={handleLogout} countUnsent={countUnsent} />;
}
