import { AppMenu } from "./app-menu";

// 画面の上のバー。左にロゴ、右にメニュー。
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4 md:px-8">
      <p className="flex items-center gap-2 text-foreground">
        <img
          src="/memotion-mark.png"
          alt=""
          className="size-7 shrink-0 object-contain dark:invert"
        />
        <span className="text-heading-sm font-bold tracking-tight">
          Memotion
        </span>
      </p>
      <AppMenu />
    </header>
  );
}
