const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 予定の日付は日本時間で固定する。端末のタイムゾーンによらず、JST で「今日」を決める。
// now の JST の日付（YYYY-MM-DD）。
export function jstToday(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}
