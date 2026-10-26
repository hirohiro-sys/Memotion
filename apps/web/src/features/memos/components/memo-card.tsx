import type { Memo } from "@repo/shared";
import { CalendarDays, Clock, ExternalLink } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScheduleDialog } from "@/features/schedule/components/schedule-dialog";
import { formatScheduleDate } from "@/features/schedule/jst";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import { useOnlineStatus } from "../offline/use-online-status";
import { TagBadge } from "./tag-badge";

export function MemoCard({
  memo,
  busy,
  selected,
  onToggle,
}: {
  memo: Memo;
  busy: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const online = useOnlineStatus();
  // オフラインで閉じたダイアログを、オンラインに戻ったときに開き直さない。
  useEffect(() => {
    if (!online) setScheduleOpen(false);
  }, [online]);
  // つぶやきは「予定にする」、予定は「日時を変更」。ほかのタグには出さない。
  const scheduleAction =
    memo.tag === "tweet"
      ? "予定にする"
      : memo.tag === "schedule"
        ? "日時を変更"
        : null;
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

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-4 transition-colors duration-200",
        selected ? "border-primary" : "border-border",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <TagBadge tag={memo.tag} size="xs" />
        <input
          type="checkbox"
          checked={selected}
          disabled={busy}
          onChange={() => onToggle(memo.id)}
          aria-label="このメモを選択"
          className="size-4 shrink-0 cursor-pointer accent-primary"
        />
      </div>

      {memo.tag === "schedule" && memo.scheduledDate ? (
        <p className="mb-2 flex items-center gap-1.5 text-body-sm font-medium text-foreground">
          <CalendarDays className="size-3.5 shrink-0 text-stone" />
          {formatScheduleDate(memo.scheduledDate)}
          <span className="tabular-nums">
            {memo.scheduledTime ?? "時間未定"}
          </span>
        </p>
      ) : null}

      <p
        ref={contentRef}
        className={cn(
          "break-words whitespace-pre-wrap text-body-sm leading-relaxed text-graphite",
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

      <div className="mt-auto flex items-center justify-between gap-2">
        {scheduleAction ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy || !online}
            title={online ? undefined : "オフラインのため使えません"}
            onClick={() => setScheduleOpen(true)}
            className="-ml-2.5 text-stone"
          >
            <CalendarDays />
            {scheduleAction}
          </Button>
        ) : (
          <span />
        )}
        <span className="flex shrink-0 items-center gap-1 text-caption text-stone">
          <Clock className="size-3" />
          {formatDate(memo.createdAt)}
        </span>
      </div>

      {scheduleAction ? (
        <ScheduleDialog
          memo={memo}
          open={scheduleOpen && online}
          onOpenChange={setScheduleOpen}
        />
      ) : null}
    </article>
  );
}
