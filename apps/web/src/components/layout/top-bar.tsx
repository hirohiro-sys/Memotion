import { Menu } from "lucide-react";
import { headingForPath } from "@/lib/page-title";

export function TopBar({
  pathname,
  onMenuClick,
}: {
  pathname: string;
  onMenuClick: () => void;
}) {
  const title = headingForPath(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-4 shadow-[0px_0.7px_1.462px_0px_rgb(0_0_0/0.015),0px_3px_9px_0px_rgb(0_0_0/0.03)] dark:shadow-none md:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-1.5 text-stone transition-colors duration-200 hover:bg-card hover:text-foreground md:hidden"
        aria-label="メニューを開く"
      >
        <Menu className="size-4" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-heading-sm font-semibold text-foreground">
        {title}
      </h1>
    </header>
  );
}
