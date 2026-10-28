const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 今月から 12 か月先まで（13 か月）を取り込む。
const MONTHS_AHEAD = 12;

function jstShifted(instant: Date): Date {
  return new Date(instant.getTime() + JST_OFFSET_MS);
}

// instant の JST の日付（YYYY-MM-DD）。
export function jstDateString(instant: Date): string {
  return jstShifted(instant).toISOString().slice(0, 10);
}

// connpass の開催日時（ISO-8601）を、予定の日付と時刻（JST）にする。読めなければ null。
export function toJstSchedule(
  startedAt: string,
): { date: string; time: string } | null {
  const instant = new Date(startedAt);
  if (Number.isNaN(instant.getTime())) return null;
  const shifted = jstShifted(instant);
  // 9 時間足すと Date の範囲を超える日時は、読めないものとして扱う（toISOString が例外を投げる）。
  if (Number.isNaN(shifted.getTime())) return null;
  const iso = shifted.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

// 取得する月（yyyymm）。JST の今月から 12 か月先まで。
export function monthsToFetch(now: Date): string[] {
  const jst = jstShifted(now);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth();
  const months: string[] = [];
  for (let i = 0; i <= MONTHS_AHEAD; i += 1) {
    const d = new Date(Date.UTC(year, month + i, 1));
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${d.getUTCFullYear()}${m}`);
  }
  return months;
}

// 取得する範囲の最終日（YYYY-MM-DD）。これより先の予定は、取得結果に無くても消さない。
export function fetchRangeEnd(now: Date): string {
  const jst = jstShifted(now);
  const end = new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + MONTHS_AHEAD + 1, 0),
  );
  return end.toISOString().slice(0, 10);
}
