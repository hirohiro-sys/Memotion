import type { Group } from "@repo/shared";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";

export function GroupList({
  groups,
  selectedId,
  onCreate,
}: {
  groups: Group[];
  selectedId?: string;
  onCreate: () => void;
}) {
  return (
    <nav aria-label="グループ一覧">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-body-sm font-medium text-graphite">
          グループ
          <span className="ml-1.5 text-caption tabular-nums text-stone">
            {groups.length}
          </span>
        </h2>
        <Button type="button" variant="secondary" size="xs" onClick={onCreate}>
          <Plus />
          新しいグループ
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {groups.map((group) => {
          const active = group.id === selectedId;
          return (
            <li key={group.id}>
              <Link
                to="/"
                search={{ view: "groups", group: group.id }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block px-4 py-3 transition-colors duration-200",
                  active ? "bg-sky-tint" : "hover:bg-muted",
                )}
              >
                <p className="truncate text-body-sm font-medium text-foreground">
                  {group.name}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-caption text-stone">
                  <span className="tabular-nums">{group.memoCount}件</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(group.lastAddedAt)}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
