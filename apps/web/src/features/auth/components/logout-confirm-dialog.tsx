import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// 未送信のメモがあるときに、破棄してログアウトしてよいかを確かめる。
export function LogoutConfirmDialog({
  open,
  onOpenChange,
  unsentCount,
  loggingOut,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unsentCount: number;
  loggingOut: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!loggingOut) onOpenChange(next);
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
            onClick={onConfirm}
          >
            破棄してログアウト
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
