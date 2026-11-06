import { jstDateTime, jstParts } from "../../lib/jst";

// 今月から 12 か月先まで（13 か月）を取り込む。
const MONTHS_AHEAD = 12;

// connpass の開催日時（ISO-8601）を、予定の日付と時刻（JST）にする。読めなければ null。
export function toJstSchedule(
  startedAt: string,
): { date: string; time: string } | null {
  return jstDateTime(new Date(startedAt));
}

// 取得する月（yyyymm）。JST の今月から 12 か月先まで。
export function monthsToFetch(now: Date): string[] {
  const { year, month } = jstParts(now);
  const months: string[] = [];
  for (let i = 0; i <= MONTHS_AHEAD; i += 1) {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${d.getUTCFullYear()}${m}`);
  }
  return months;
}

// 取得する範囲の最終日（YYYY-MM-DD）。これより先の予定は、取得結果に無くても消さない。
export function fetchRangeEnd(now: Date): string {
  const { year, month } = jstParts(now);
  const end = new Date(Date.UTC(year, month - 1 + MONTHS_AHEAD + 1, 0));
  return end.toISOString().slice(0, 10);
}
