// 通知の送信済みの記録の、KV での読み書き。例外はそのまま投げ、扱いは呼び出し側が決める。
// 期限は付けない（次の通知の時刻を決めるのに使い続ける）。

const LAST_SENT_AT_KEYS = {
  techWeekly: "notify:tech-weekly:last-sent-at",
  todoDaily: "notify:todo-daily:last-sent-at",
} as const;
const SCHEDULE_LAST_TARGET_DATE_KEY = "notify:schedule-daily:last-target-date";

export type SentAtKind = keyof typeof LAST_SENT_AT_KEYS;

export async function readLastSentAt(
  kv: KVNamespace,
  kind: SentAtKind,
): Promise<string | null> {
  return kv.get(LAST_SENT_AT_KEYS[kind]);
}

export async function writeLastSentAt(
  kv: KVNamespace,
  kind: SentAtKind,
  sentAt: string,
): Promise<void> {
  await kv.put(LAST_SENT_AT_KEYS[kind], sentAt);
}

export async function readScheduleLastTargetDate(
  kv: KVNamespace,
): Promise<string | null> {
  return kv.get(SCHEDULE_LAST_TARGET_DATE_KEY);
}

export async function writeScheduleLastTargetDate(
  kv: KVNamespace,
  targetDate: string,
): Promise<void> {
  await kv.put(SCHEDULE_LAST_TARGET_DATE_KEY, targetDate);
}

// 先取りを戻す。前の対象日が無ければ記録を消す。
export async function restoreScheduleLastTargetDate(
  kv: KVNamespace,
  previous: string | null,
): Promise<void> {
  if (previous === null) {
    await kv.delete(SCHEDULE_LAST_TARGET_DATE_KEY);
    return;
  }
  await kv.put(SCHEDULE_LAST_TARGET_DATE_KEY, previous);
}
