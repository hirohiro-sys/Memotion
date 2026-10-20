import type { Memo } from "@repo/shared";

export type DaySection = { key: string; label: string; memos: Memo[] };

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dayLabel(date: Date, now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  const weekday = WEEKDAYS[date.getDay()];
  const md = `${date.getMonth() + 1}月${date.getDate()}日（${weekday}）`;
  return date.getFullYear() === now.getFullYear()
    ? md
    : `${date.getFullYear()}年${md}`;
}

// チャットのように古い順に並べ、端末の日付ごとに区切る。
export function toDaySections(memos: Memo[], now: Date): DaySection[] {
  const sorted = [...memos].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  const sections: DaySection[] = [];
  for (const memo of sorted) {
    const date = new Date(memo.createdAt);
    const key = dayKey(date);
    const last = sections.at(-1);
    if (last?.key === key) {
      last.memos.push(memo);
    } else {
      sections.push({ key, label: dayLabel(date, now), memos: [memo] });
    }
  }
  return sections;
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}
