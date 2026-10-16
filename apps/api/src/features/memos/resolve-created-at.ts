const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

// 端末で書いた時刻を保存時刻にする。DB は createdAt を文字列で並べ替えるため、
// 常に toISOString() の形へ正規化する。端末の時計が先に進みすぎていたら現在時刻にする。
export function resolveCreatedAt(
  requested: string | undefined,
  now: Date,
): string {
  if (!requested) return now.toISOString();

  const writtenAt = new Date(requested);
  if (Number.isNaN(writtenAt.getTime())) return now.toISOString();
  if (writtenAt.getTime() - now.getTime() > MAX_CLOCK_SKEW_MS) {
    return now.toISOString();
  }
  return writtenAt.toISOString();
}
