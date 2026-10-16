import { Clock, CloudOff, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import type { OutboxItem } from "../offline/outbox";
import { TagBadge } from "./tag-badge";

// 未送信リストのメモ。選択・一括削除の対象にはせず、カードごとの破棄だけを持つ。
export function PendingMemoCard({
  item,
  onDiscard,
}: {
  item: OutboxItem;
  onDiscard: (id: string) => void;
}) {
  const failed = item.status === "failed";

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-dashed bg-card p-4",
        failed ? "border-destructive/60" : "border-border",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <TagBadge tag={item.tag} size="xs" />
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            failed
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-stone",
          )}
        >
          {failed ? (
            <TriangleAlert className="size-3" />
          ) : (
            <CloudOff className="size-3" />
          )}
          {failed ? "送信できません" : "送信待ち"}
        </span>
      </div>

      <p className="mb-2 line-clamp-3 break-words whitespace-pre-wrap text-body-sm leading-relaxed text-graphite">
        {item.content}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2">
        {/* 送信待ちのまま抜けないメモも、利用者が消せるようにする */}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onDiscard(item.id)}
        >
          破棄
        </Button>
        <span className="flex shrink-0 items-center gap-1 text-caption text-stone">
          <Clock className="size-3" />
          {formatDate(item.createdAt)}
        </span>
      </div>
    </article>
  );
}
