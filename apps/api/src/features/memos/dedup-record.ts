import type { MemoMediaType, MemoSource, MemoTag } from "@repo/shared";

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

// Web で保存したメモの記録。持ち主は再送の判定にだけ使い、応答やログに出さない。
// 予定でないメモの日時は null。
export type WebMemoRecord = {
  id: string;
  userId: string;
  tag: MemoTag;
  content: string;
  mediaType: MemoMediaType;
  source: MemoSource;
  createdAt: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

const TAGS = new Set<string>(["tweet", "tech", "other", "todo", "schedule"]);
const MEDIA_TYPES = new Set<string>(["text", "url"]);
const SOURCES = new Set<string>(["line", "web"]);
const STRING_KEYS = ["id", "userId", "content", "createdAt"] as const;
const NULLABLE_KEYS = ["scheduledDate", "scheduledTime"] as const;

// KV から読んだ Web の記録を、再送の判定に使う形に戻す。
// 形が合わないもの（壊れた値、画像のメモの記録）は記録なしとして扱い、Notion の検索に任せる。
// D1 のころの記録にある url、imageKey、groupId は読まない。
export function parseWebMemoRecord(raw: unknown): WebMemoRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  for (const key of STRING_KEYS) {
    if (typeof record[key] !== "string") return null;
  }
  for (const key of NULLABLE_KEYS) {
    if (record[key] !== null && typeof record[key] !== "string") return null;
  }
  const { tag, mediaType, source } = record;
  if (typeof tag !== "string" || !TAGS.has(tag)) return null;
  if (typeof mediaType !== "string" || !MEDIA_TYPES.has(mediaType)) {
    return null;
  }
  if (typeof source !== "string" || !SOURCES.has(source)) return null;
  return {
    id: record.id as string,
    userId: record.userId as string,
    tag: tag as MemoTag,
    content: record.content as string,
    mediaType: mediaType as MemoMediaType,
    source: source as MemoSource,
    createdAt: record.createdAt as string,
    scheduledDate: record.scheduledDate as string | null,
    scheduledTime: record.scheduledTime as string | null,
  };
}
