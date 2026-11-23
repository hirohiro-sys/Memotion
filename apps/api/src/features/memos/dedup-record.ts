import type { ExistingMemoRow } from "./idempotency";
import type { MemoRow } from "./repository";

// KV に置く重複判定の記録の、キーと保持期間と値の形。
// LINE の再送は Worker が 200 を返せなかったときだけ来るので短く、
// Web のオフライン再送は端末がオンラインに戻るまで遅れうるので長く持つ。
export const LINE_MESSAGE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const WEB_MEMO_TTL_SECONDS = 30 * 24 * 60 * 60;

export function lineMessageKey(lineMessageId: string): string {
  return `line-message:${lineMessageId}`;
}

export function webMemoKey(memoId: string): string {
  return `web-memo:${memoId}`;
}

// 保存した行に持ち主を足して、Web の記録にする。持ち主が無いと再送の判定に使えない。
export function toWebMemoRecord(row: MemoRow, userId: string): ExistingMemoRow {
  return { ...row, userId };
}

const STRING_KEYS = [
  "id",
  "userId",
  "tag",
  "content",
  "mediaType",
  "source",
  "createdAt",
] as const;
const NULLABLE_KEYS = [
  "url",
  "imageKey",
  "groupId",
  "scheduledDate",
  "scheduledTime",
] as const;

// KV から読んだ Web の記録を、再送の判定に使う既存行に戻す。
// 形が合わないもの（壊れた値、古い形式）は記録なしとして扱い、D1 の判定に任せる。
export function parseWebMemoRecord(raw: unknown): ExistingMemoRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  for (const key of STRING_KEYS) {
    if (typeof record[key] !== "string") return null;
  }
  for (const key of NULLABLE_KEYS) {
    if (record[key] !== null && typeof record[key] !== "string") return null;
  }
  return {
    id: record.id as string,
    userId: record.userId as string,
    tag: record.tag as string,
    content: record.content as string,
    url: record.url as string | null,
    imageKey: record.imageKey as string | null,
    mediaType: record.mediaType as string,
    source: record.source as string,
    createdAt: record.createdAt as string,
    groupId: record.groupId as string | null,
    scheduledDate: record.scheduledDate as string | null,
    scheduledTime: record.scheduledTime as string | null,
  };
}
