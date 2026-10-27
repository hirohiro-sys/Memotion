import { CalendarX2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/features/memos/offline/use-online-status";
import type { ScheduleMemo } from "../day-schedule";
import { formatScheduleDate } from "../jst";
import { ScheduleDialog } from "./schedule-dialog";

// 選んだ日の予定の一覧。各予定に「日時を変更」と「削除」を置く。
// 日ごとのメモは、children として下に別の節で出す。日報も同じ形で足せる。
export function DaySchedulePanel({
  date,
  schedules,
  busy,
  onDelete,
  children,
}: {
  date: string;
  schedules: ScheduleMemo[];
  busy: boolean;
  onDelete: (memo: ScheduleMemo) => void;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <h2 className="mb-4 text-body font-medium text-foreground">
        {formatScheduleDate(date)}の予定
      </h2>
      {schedules.length === 0 ? (
        <div className="py-8 text-center">
          <CalendarX2 className="mx-auto mb-2 size-5 text-stone" />
          <p className="text-body-sm text-stone">予定はありません</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {schedules.map((memo) => (
            <DayScheduleItem
              key={memo.id}
              memo={memo}
              busy={busy}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}

function DayScheduleItem({
  memo,
  busy,
  onDelete,
}: {
  memo: ScheduleMemo;
  busy: boolean;
  onDelete: (memo: ScheduleMemo) => void;
}) {
  const [editing, setEditing] = useState(false);
  const online = useOnlineStatus();
  // オフラインで閉じたダイアログを、オンラインに戻ったときに開き直さない。
  useEffect(() => {
    if (!online) setEditing(false);
  }, [online]);

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="w-16 shrink-0 pt-0.5 text-caption font-medium text-stone tabular-nums">
        {memo.scheduledTime ?? "時間未定"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 line-clamp-3 break-words whitespace-pre-wrap text-body-sm text-graphite">
          {memo.content}
        </p>
        <div className="-ml-2.5 flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy || !online}
            title={online ? undefined : "オフラインのため使えません"}
            onClick={() => setEditing(true)}
            className="text-stone"
          >
            日時を変更
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy || !online}
            title={online ? undefined : "オフラインのため使えません"}
            onClick={() => onDelete(memo)}
            className="text-stone hover:text-destructive"
          >
            削除
          </Button>
        </div>
      </div>
      <ScheduleDialog
        memo={memo}
        open={editing && online}
        onOpenChange={setEditing}
      />
    </li>
  );
}
