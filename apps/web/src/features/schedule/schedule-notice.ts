import { addDays, jstClock, jstToday } from "./jst";

// その日付の予定に、前日の通知が届くか（JST）。
// 届かないのは、日付が今日（以前）のときと、日付が明日で、今日の通知の時刻をすでに過ぎているとき。
export function willBeNotified(
  date: string,
  now: Date,
  dailyTime: string,
): boolean {
  const today = jstToday(now);
  if (date <= today) return false;
  if (date === addDays(today, 1)) return jstClock(now) < dailyTime;
  return true;
}
