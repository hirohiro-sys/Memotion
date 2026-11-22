import type { Memo } from "@repo/shared";
import { jstLocalDateTime } from "../../lib/jst";

// Notion のデータベースのプロパティ名。Notion 側の列名と1文字でも違うと 400 になる。
export const NOTION_PROPERTY = {
  content: "本文",
  tag: "種類",
  scheduledAt: "予定日時",
  createdAt: "記録日時",
  url: "URL",
  source: "入力元",
  memoId: "メモID",
} as const;

const TIME_ZONE = "Asia/Tokyo";
// Notion のテキストのオブジェクトは1つ2000字まで、配列は100個まで。
const MAX_TEXT_LENGTH = 2000;
const MAX_TEXT_OBJECTS = 100;

export type NotionMemo = Pick<
  Memo,
  | "id"
  | "tag"
  | "content"
  | "mediaType"
  | "source"
  | "createdAt"
  | "scheduledDate"
  | "scheduledTime"
>;

type TextObject = { type: "text"; text: { content: string } };

// 2000字（UTF-16 の長さ）ごとに分ける。サロゲートペアの途中では切らない。
// 100個を超える分は捨てる。
export function splitNotionText(text: string): TextObject[] {
  const chunks: string[] = [];
  let current = "";
  for (const char of text) {
    if (current.length + char.length > MAX_TEXT_LENGTH) {
      chunks.push(current);
      current = "";
    }
    current += char;
  }
  if (current.length > 0) chunks.push(current);
  return chunks
    .slice(0, MAX_TEXT_OBJECTS)
    .map((content) => ({ type: "text", text: { content } }));
}

function scheduledAtProperty(memo: NotionMemo) {
  if (memo.tag !== "schedule" || !memo.scheduledDate) return null;
  if (!memo.scheduledTime) return { date: { start: memo.scheduledDate } };
  return {
    date: {
      start: `${memo.scheduledDate}T${memo.scheduledTime}:00`,
      time_zone: TIME_ZONE,
    },
  };
}

function createdAtProperty(createdAt: string) {
  const start = jstLocalDateTime(new Date(createdAt));
  if (!start) return null;
  return { date: { start, time_zone: TIME_ZONE } };
}

// メモ1件から、Notion のページを作るリクエストの本文を組み立てる。
// URL のメモは、URL のプロパティに入れ、ページ本文にブックマークのブロックを置く。
export function buildNotionPage(memo: NotionMemo, dataSourceId: string) {
  const scheduledAt = scheduledAtProperty(memo);
  const createdAt = createdAtProperty(memo.createdAt);
  const isUrl = memo.mediaType === "url";

  return {
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: {
      [NOTION_PROPERTY.content]: { title: splitNotionText(memo.content) },
      [NOTION_PROPERTY.tag]: { select: { name: memo.tag } },
      [NOTION_PROPERTY.source]: { select: { name: memo.source } },
      [NOTION_PROPERTY.memoId]: { rich_text: splitNotionText(memo.id) },
      ...(scheduledAt ? { [NOTION_PROPERTY.scheduledAt]: scheduledAt } : {}),
      ...(createdAt ? { [NOTION_PROPERTY.createdAt]: createdAt } : {}),
      ...(isUrl ? { [NOTION_PROPERTY.url]: { url: memo.content } } : {}),
    },
    ...(isUrl
      ? {
          children: [
            {
              object: "block",
              type: "bookmark",
              bookmark: { url: memo.content },
            },
          ],
        }
      : {}),
  };
}
