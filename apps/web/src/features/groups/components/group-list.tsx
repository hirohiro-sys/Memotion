import type { Group } from "@repo/shared";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";

// グループの一覧。チャットの会話一覧のように、頭文字・名前・最後に入れた日時・件数を1行にまとめる。
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
    <nav aria-label="グループ一覧" className="flex min-h-0 w-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="text-caption font-medium tracking-wide text-stone">
          グループ
          <span className="ml-1.5 tabular-nums">{groups.length}</span>
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCreate}
          aria-label="新しいグループを作る"
          className="text-stone hover:text-foreground"
        >
          <Plus />
        </Button>
      </div>

      <ul className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1 pb-2">
        {groups.map((group) => {
          const active = group.id === selectedId;
          return (
            <li key={group.id}>
              <Link
                to="/"
                search={{ view: "groups", group: group.id }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg border px-3 py-2.5 transition-colors duration-200",
                  active
                    ? "border-border bg-card"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-body-sm font-medium text-foreground">
                      {group.name}
                    </span>
                    <span className="shrink-0 text-caption text-stone">
                      {formatDate(group.lastAddedAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-caption tabular-nums text-stone">
                    {group.memoCount > 0
                      ? `メモ ${group.memoCount}件`
                      : "まだメモがありません"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
