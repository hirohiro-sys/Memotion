import {
  addDays,
  jstClock,
  jstToday,
  parseDate,
} from "@/features/schedule/jst";

function weekdayOf(date: string): number {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// 週次の通知が次に届く日（JST）。今日がその曜日で、時刻をまだ過ぎていなければ今日。
export function nextWeeklyDate(
  now: Date,
  weekday: number,
  time: string,
): string {
  const today = jstToday(now);
  const diff = (weekday - weekdayOf(today) + 7) % 7;
  if (diff === 0 && jstClock(now) >= time) return addDays(today, 7);
  return addDays(today, diff);
}

// 毎日の通知が次に届く日（JST）。今日の時刻をまだ過ぎていなければ今日、過ぎていれば明日。
export function nextDailyDate(now: Date, time: string): string {
  const today = jstToday(now);
  return jstClock(now) < time ? today : addDays(today, 1);
}

// 「10月6日」。
export function formatMonthDay(date: string): string {
  const { month, day } = parseDate(date);
  return `${month}月${day}日`;
}
