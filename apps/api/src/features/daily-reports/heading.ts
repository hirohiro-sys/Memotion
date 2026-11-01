import type { DailyReportKind } from "@repo/shared";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

// 先頭行。年は出さない。日付の曜日は UTC の暦で決め、実行時の時計は見ない。
export function headingLine(reportDate: string, kind: DailyReportKind): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reportDate);
  if (!match) {
    throw new Error("invalid report date");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday =
    WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
  const label = kind === "work" ? "仕事" : "個人";
  return `${month}月${day}日（${weekday}） ${label}`;
}
