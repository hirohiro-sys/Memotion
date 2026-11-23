import {
  LINE_MESSAGE_TTL_SECONDS,
  lineMessageKey,
  parseWebMemoRecord,
  WEB_MEMO_TTL_SECONDS,
  webMemoKey,
} from "./dedup-record";
import type { ExistingMemoRow } from "./idempotency";

// KV の重複判定の記録の読み書き。例外はそのまま投げ、扱いは service が決める。

export async function hasLineMessage(
  kv: KVNamespace,
  lineMessageId: string,
): Promise<boolean> {
  return (await kv.get(lineMessageKey(lineMessageId))) !== null;
}

export async function putLineMessage(
  kv: KVNamespace,
  lineMessageId: string,
  memoId: string,
): Promise<void> {
  await kv.put(lineMessageKey(lineMessageId), JSON.stringify({ memoId }), {
    expirationTtl: LINE_MESSAGE_TTL_SECONDS,
  });
}

export async function findWebMemo(
  kv: KVNamespace,
  memoId: string,
): Promise<ExistingMemoRow | null> {
  return parseWebMemoRecord(await kv.get(webMemoKey(memoId), "json"));
}

export async function putWebMemo(
  kv: KVNamespace,
  row: ExistingMemoRow,
): Promise<void> {
  await kv.put(webMemoKey(row.id), JSON.stringify(row), {
    expirationTtl: WEB_MEMO_TTL_SECONDS,
  });
}
