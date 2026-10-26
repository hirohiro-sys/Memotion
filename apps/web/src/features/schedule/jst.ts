import { WEEKDAYS } from "@/config/tag-meta";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 予定の日付と時刻は日本時間で固定する。端末のタイムゾーンによらず、JST で「今日」と「今の時刻」を決める。
function jstShifted(now: Date): Date {
  return new Date(now.getTime() + JST_OFFSET_MS);
}

// now の JST の日付（YYYY-MM-DD）。
export function jstToday(now: Date): string {
  return jstShifted(now).toISOString().slice(0, 10);
}

// now の JST の時刻（HH:MM）。
export function jstClock(now: Date): string {
  return jstShifted(now).toISOString().slice(11, 16);
}

export function parseDate(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

export function toDateString(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  return toDateString(year, month, day + days);
}

function weekdayOf(date: string): string {
  const { year, month, day } = parseDate(date);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
}

// 「11月3日（火）」。
export function formatScheduleDate(date: string): string {
  const { month, day } = parseDate(date);
  return `${month}月${day}日（${weekdayOf(date)}）`;
}
