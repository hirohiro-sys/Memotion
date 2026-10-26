import { parseDate, toDateString } from "./jst";

export type MonthCell = { date: string; day: number; inMonth: boolean };

// 日曜始まりの月の格子。前後の月の日で週を埋める。
export function buildMonthGrid(year: number, month: number): MonthCell[][] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);

  const weeks: MonthCell[][] = [];
  for (let week = 0; week < weekCount; week += 1) {
    const cells: MonthCell[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const offset = week * 7 + weekday - firstWeekday + 1;
      const date = toDateString(year, month, offset);
      cells.push({
        date,
        day: parseDate(date).day,
        inMonth: offset >= 1 && offset <= daysInMonth,
      });
    }
    weeks.push(cells);
  }
  return weeks;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}
