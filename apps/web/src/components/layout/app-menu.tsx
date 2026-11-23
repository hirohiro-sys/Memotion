import { Menu } from "@base-ui/react/menu";
import { Ellipsis, LogOut, MonitorSmartphone, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { applyTheme, getStoredTheme } from "@/config/theme";
import { LogoutConfirmDialog } from "@/features/auth/components/logout-confirm-dialog";
import { useLogout } from "@/features/auth/use-logout";
import { PwaInstallDialog } from "@/features/pwa/components/pwa-install-dialog";
import { cn } from "@/utils/cn";

const ITEM =
  "flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-body-sm outline-none select-none transition-colors duration-200 data-highlighted:bg-muted";

// 上のバーの右端のメニュー。表示の切り替え、アプリとして使う案内、ログアウトを置く。
export function AppMenu() {
  const [theme, setTheme] = useState<"light" | "dark">(getStoredTheme);
  const [guideOpen, setGuideOpen] = useState(false);
  const logout = useLogout();
  const dark = theme === "dark";

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label="メニュー"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "text-stone hover:text-foreground",
          )}
        >
          <Ellipsis />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={6} className="z-50">
            <Menu.Popup className="min-w-48 rounded-lg border border-border bg-popover p-1 shadow-pop text-popover-foreground outline-none transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0">
              <Menu.Item
                onClick={toggleTheme}
                className={cn(ITEM, "text-foreground")}
              >
                {dark ? (
                  <Sun className="size-3.5 text-stone" />
                ) : (
                  <Moon className="size-3.5 text-stone" />
                )}
                {dark ? "ライトモードにする" : "ダークモードにする"}
              </Menu.Item>
              <Menu.Item
                onClick={() => setGuideOpen(true)}
                className={cn(ITEM, "text-foreground")}
              >
                <MonitorSmartphone className="size-3.5 text-stone" />
                アプリとして使う
              </Menu.Item>
              <Menu.Separator className="my-1 h-px bg-border" />
              <Menu.Item
                disabled={logout.loggingOut}
                onClick={() => void logout.request()}
                className={cn(ITEM, "text-destructive")}
              >
                <LogOut className="size-3.5" />
                ログアウト
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <PwaInstallDialog open={guideOpen} onOpenChange={setGuideOpen} />
      <LogoutConfirmDialog
        open={logout.confirmOpen}
        onOpenChange={logout.setConfirmOpen}
        unsentCount={logout.unsentCount}
        loggingOut={logout.loggingOut}
        onConfirm={() => void logout.confirm()}
      />
    </>
  );
}
