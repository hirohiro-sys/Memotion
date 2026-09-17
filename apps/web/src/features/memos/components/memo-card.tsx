import type { Memo } from "@repo/shared";
import { Clock, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/utils/format";
import { TagBadge } from "./tag-badge";

export function MemoCard({
  memo,
  busy,
  onDelete,
}: {
  memo: Memo;
  busy: boolean;
  onDelete: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    try {
      await onDelete(memo.id);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <TagBadge tag={memo.tag} />
        <span className="flex shrink-0 items-center gap-1 text-caption text-stone">
          <Clock className="size-3" />
          {formatDate(memo.createdAt)}
        </span>
      </div>

      <p className="mb-3 break-words text-body-sm leading-relaxed text-graphite">
        {memo.content}
      </p>

      {memo.url && (
        <a
          href={memo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex items-center gap-1.5 text-caption text-stone underline-offset-2 transition-colors duration-200 hover:text-foreground hover:underline"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          <span className="max-w-[240px] truncate">{memo.url}</span>
        </a>
      )}

      {memo.thumbnailUrl && (
        <img
          src={memo.thumbnailUrl}
          alt=""
          className="mb-3 h-28 w-full rounded-lg object-cover"
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-caption text-stone">
          {memo.source === "line" ? "LINE" : "Web"}
        </span>
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="xs"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              削除する
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            削除
          </Button>
        )}
      </div>
    </article>
  );
}
