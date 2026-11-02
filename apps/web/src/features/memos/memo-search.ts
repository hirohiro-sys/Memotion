import type { Memo } from "@repo/shared";
import { scheduleCardLine } from "@/features/schedule/card-line";

export type MemoSearchTarget = Pick<
  Memo,
  "content" | "url" | "tag" | "scheduledDate" | "scheduledTime"
>;

export function memoMatchesQuery(
  memo: MemoSearchTarget,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (query.length === 0) return true;
  if (memo.content.toLowerCase().includes(query)) return true;
  if (memo.url?.toLowerCase().includes(query)) return true;
  const line = scheduleCardLine(memo);
  if (!line) return false;
  return `${line.dateLabel} ${line.timeLabel}`.toLowerCase().includes(query);
}
