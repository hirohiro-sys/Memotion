import type { Memo } from "@repo/shared";
import { Clock, ExternalLink } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
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
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    function measure() {
      const target = contentRef.current;
      if (!target || expanded) return;
      setOverflows(target.scrollHeight > target.clientHeight + 1);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded]);

  async function handleDelete() {
    try {
      await onDelete(memo.id);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <TagBadge tag={memo.tag} size="xs" />
        <span className="flex shrink-0 items-center gap-1 text-caption text-stone">
          <Clock className="size-3" />
          {formatDate(memo.createdAt)}
        </span>
      </div>

      <p
        ref={contentRef}
        className={cn(
          "break-words text-body-sm leading-relaxed text-graphite",
          overflows || expanded ? "mb-1" : "mb-2",
          !expanded && "line-clamp-3",
        )}
      >
        {memo.content}
      </p>
      {overflows ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mb-2 text-caption text-stone transition-colors duration-200 hover:text-foreground"
        >
          {expanded ? "閉じる" : "続きを読む"}
        </button>
      ) : null}

      {memo.url && (
        <a
          href={memo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex items-center gap-1.5 text-caption text-stone underline-offset-2 transition-colors duration-200 hover:text-foreground hover:underline"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          <span className="max-w-[240px] truncate">{memo.url}</span>
        </a>
      )}

      {memo.thumbnailUrl &&
        (memo.mediaType === "url" ? (
          <a
            href={memo.content}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={memo.content}
            className="mb-2 block overflow-hidden rounded-lg"
          >
            <img
              src={memo.thumbnailUrl}
              alt=""
              className="h-32 w-full object-cover"
            />
          </a>
        ) : (
          <img
            src={memo.thumbnailUrl}
            alt=""
            className="mb-2 h-20 w-full rounded-lg object-cover"
          />
        ))}

      <div className="mt-auto flex items-center justify-end gap-3">
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
