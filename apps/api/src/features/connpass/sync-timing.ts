// 手動は前回から 60 秒、Cron は 1 時間たっていれば取り込める。
export const MANUAL_INTERVAL_MS = 60 * 1000;
export const CRON_INTERVAL_MS = 60 * 60 * 1000;

// この時刻以前に取り込んだ（または一度も取り込んでいない）ユーザーが、取り込みの対象になる。
export function syncNotAfter(now: Date, intervalMs: number): string {
  return new Date(now.getTime() - intervalMs).toISOString();
}

// 前回の取り込みから間隔があいているか。ちょうど間隔だけ前なら取り込める。
// SQL の先取り（last_synced_at <= notAfter）と同じ境界にする。
export function isSyncDue(
  lastSyncedAt: string | null,
  now: Date,
  intervalMs: number,
): boolean {
  if (lastSyncedAt === null) return true;
  return lastSyncedAt <= syncNotAfter(now, intervalMs);
}
