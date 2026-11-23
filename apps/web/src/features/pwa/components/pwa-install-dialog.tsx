import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PwaInstallGuide } from "./pwa-install-guide";

// 上のメニューから開く「アプリとして使う」の案内。
export function PwaInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <PwaInstallGuide />
        <AlertDialogFooter className="mt-4">
          <AlertDialogClose
            render={<Button type="button" variant="ghost" size="sm" />}
          >
            閉じる
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
