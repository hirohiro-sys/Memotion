import { Link } from "@tanstack/react-router";
import { cn } from "@/utils/cn";

const TABS = [
  { view: "memos", label: "メモ", search: {} },
  { view: "groups", label: "グループ", search: { view: "groups" as const } },
] as const;

export function MemoPageTabs({ view }: { view: "memos" | "groups" }) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 md:px-8 md:pt-8">
      <div role="tablist" className="flex gap-6 border-b border-border">
        {TABS.map((tab) => {
          const active = tab.view === view;
          return (
            <Link
              key={tab.view}
              to="/"
              search={tab.search}
              role="tab"
              aria-selected={active}
              className={cn(
                "-mb-px border-b-2 pb-2 text-body-sm font-medium transition-colors duration-200",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-stone hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
