import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { flushOutbox, onOutboxFlushRequest } from "./flush";

// 送信のきっかけ（起動時・電波の復帰・画面への復帰・メモの追加）で未送信リストを送る。
// アプリのレイアウトで1回だけ使う。
export function useOutboxSync() {
  const router = useRouter();

  const flush = useCallback(async () => {
    try {
      const result = await flushOutbox();
      if (result.saved > 0) {
        toast.add({
          title:
            result.saved === 1
              ? "保存しました"
              : `${result.saved}件のメモを保存しました`,
          type: "success",
        });
      }
      // セッション切れ。ログインの確認をやり直し、ログイン画面へ移す（メモは残る）。
      if (result.status === "unauthorized") await router.invalidate();
    } catch (error) {
      // 未送信リストが使えない環境。次のきっかけで再び試す。
      if (import.meta.env.DEV) console.error(error);
    }
  }, [router]);

  useEffect(() => {
    void flush();

    function handleVisibility() {
      if (document.visibilityState === "visible") void flush();
    }
    const handleTrigger = () => void flush();

    window.addEventListener("online", handleTrigger);
    document.addEventListener("visibilitychange", handleVisibility);
    const unsubscribe = onOutboxFlushRequest(handleTrigger);
    return () => {
      window.removeEventListener("online", handleTrigger);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe();
    };
  }, [flush]);
}
