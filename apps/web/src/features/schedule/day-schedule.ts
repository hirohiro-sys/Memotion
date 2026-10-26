import type { Memo } from "@repo/shared";

export type ScheduleMemo = Memo & { scheduledDate: string };

export function isScheduleMemo(memo: Memo): memo is ScheduleMemo {
  return memo.tag === "schedule" && memo.scheduledDate !== undefined;
}

// 時刻のない予定が先頭。残りは時刻の早い順。同じ時刻は登録順（LINE の通知と同じ並び）。
function bySchedule(a: ScheduleMemo, b: ScheduleMemo): number {
  const timeA = a.scheduledTime ?? null;
  const timeB = b.scheduledTime ?? null;
  if (timeA !== timeB) {
    if (timeA === null) return -1;
    if (timeB === null) return 1;
    return timeA.localeCompare(timeB);
  }
  return a.createdAt.localeCompare(b.createdAt);
}

// 日付ごとに予定をまとめ、並べ替える。
export function groupSchedulesByDate(
  memos: Memo[],
): Map<string, ScheduleMemo[]> {
  const byDate = new Map<string, ScheduleMemo[]>();
  for (const memo of memos) {
    if (!isScheduleMemo(memo)) continue;
    const list = byDate.get(memo.scheduledDate) ?? [];
    list.push(memo);
    byDate.set(memo.scheduledDate, list);
  }
  for (const list of byDate.values()) list.sort(bySchedule);
  return byDate;
}
