import type { Memo } from "@repo/shared";
import { ExternalLink } from "lucide-react";
import { TagBadge } from "@/features/memos/components/tag-badge";
import { formatClock } from "../day-sections";

// グループの中のメモ1件。自分だけが書くチャットなので、すべて右寄せの吹き出しにする。
export function MemoBubble({ memo }: { memo: Memo }) {
  const isUrl = memo.mediaType === "url";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[min(85%,560px)] overflow-hidden rounded-xl rounded-br-sm border border-border bg-card">
        {isUrl ? (
          <a
            href={memo.content}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link block"
          >
            {memo.thumbnailUrl ? (
              <img
                src={memo.thumbnailUrl}
                alt=""
                className="h-36 w-full border-b border-border object-cover"
              />
            ) : null}
            <span className="flex items-start gap-2 px-3.5 py-2.5 text-body-sm text-secondary-foreground">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
              <span className="break-all underline-offset-2 group-hover/link:underline">
                {memo.content}
              </span>
            </span>
          </a>
        ) : (
          <>
            {memo.mediaType === "image" && memo.thumbnailUrl ? (
              <img
                src={memo.thumbnailUrl}
                alt=""
                className="max-h-72 w-full object-cover"
              />
            ) : null}
            {memo.content ? (
              <p className="px-3.5 py-2.5 text-body-sm break-words whitespace-pre-wrap text-foreground/95">
                {memo.content}
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 pr-1 text-caption text-stone">
        <TagBadge tag={memo.tag} size="xs" />
        <time dateTime={memo.createdAt} className="tabular-nums">
          {formatClock(memo.createdAt)}
        </time>
      </div>
    </div>
  );
}
