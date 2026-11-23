import type { Env } from "../../env";

// 通知の送信済みの記録の読み書き。置き場は Durable Object（NOTIFY_STATE）。
// 例外はそのまま投げ、扱いは呼び出し側が決める。期限は付けない（次の通知の時刻を決めるのに使い続ける）。

export type SentStore = {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

const INSTANCE_NAME = "notify";

export function sentStoreFor(env: Pick<Env, "NOTIFY_STATE">): SentStore {
  return env.NOTIFY_STATE.get(env.NOTIFY_STATE.idFromName(INSTANCE_NAME));
}

const LAST_SENT_AT_KEYS = {
  techWeekly: "tech-weekly:last-sent-at",
  todoDaily: "todo-daily:last-sent-at",
} as const;
const SCHEDULE_LAST_TARGET_DATE_KEY = "schedule-daily:last-target-date";

export type SentAtKind = keyof typeof LAST_SENT_AT_KEYS;

export async function readLastSentAt(
  store: SentStore,
  kind: SentAtKind,
): Promise<string | null> {
  return store.read(LAST_SENT_AT_KEYS[kind]);
}

export async function writeLastSentAt(
  store: SentStore,
  kind: SentAtKind,
  sentAt: string,
): Promise<void> {
  await store.write(LAST_SENT_AT_KEYS[kind], sentAt);
}

export async function readScheduleLastTargetDate(
  store: SentStore,
): Promise<string | null> {
  return store.read(SCHEDULE_LAST_TARGET_DATE_KEY);
}

export async function writeScheduleLastTargetDate(
  store: SentStore,
  targetDate: string,
): Promise<void> {
  await store.write(SCHEDULE_LAST_TARGET_DATE_KEY, targetDate);
}

// 先取りを戻す。前の対象日が無ければ記録を消す。
export async function restoreScheduleLastTargetDate(
  store: SentStore,
  previous: string | null,
): Promise<void> {
  if (previous === null) {
    await store.remove(SCHEDULE_LAST_TARGET_DATE_KEY);
    return;
  }
  await store.write(SCHEDULE_LAST_TARGET_DATE_KEY, previous);
}
