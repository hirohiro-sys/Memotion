import { LogOut } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// ログアウトのボタン。未送信のメモがあれば、破棄してよいかを確かめてからログアウトする。
export function LogoutButton({
  onLogout,
  countUnsent,
}: {
  onLogout: () => Promise<void>;
  countUnsent: () => Promise<number>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unsentCount, setUnsentCount] = useState(0);

  // 未送信のメモがあれば確認してから、無ければそのままログアウトする。
  async function requestLogout() {
    const count = await countUnsent();
    if (count > 0) {
      setUnsentCount(count);
      setConfirmOpen(true);
      return;
    }
    await handleLogout();
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={loggingOut}
        onClick={() => void requestLogout()}
      >
        <LogOut className="size-3.5" /> ログアウト
      </Button>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!loggingOut) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            未送信のメモが{unsentCount}件あります
          </AlertDialogTitle>
          <AlertDialogDescription>
            ログアウトすると、この端末の未送信のメモは破棄されます。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button type="button" variant="ghost" size="sm" />}
              disabled={loggingOut}
            >
              キャンセル
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              破棄してログアウト
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
