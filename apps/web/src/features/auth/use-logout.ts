import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { clearOutbox, listOutboxItems } from "@/features/memos/offline/outbox";
import { logout } from "./api/logout";
import { clearStoredUserId, getStoredUserId } from "./stored-user-id";

// ログアウトの手順。未送信のメモがあれば、破棄してよいかを確かめてからログアウトする。
export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unsentCount, setUnsentCount] = useState(0);

  // 押した時点の件数を読む（画面の表示より前に押されても確認を出すため）。
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
  async function confirm() {
    setLoggingOut(true);
    try {
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
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  async function request() {
    const count = await countUnsent();
    if (count > 0) {
      setUnsentCount(count);
      setConfirmOpen(true);
      return;
    }
    await confirm();
  }

  return {
    request,
    confirm,
    confirmOpen,
    setConfirmOpen,
    loggingOut,
    unsentCount,
  };
}
