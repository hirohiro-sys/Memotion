import { jstDateTime, nextDateString } from "../../lib/jst";
import { NOTION_PROPERTY } from "./notion-page";

// Notion のデータソースを検索するリクエストの本文と、結果のページをメモに戻す処理。
// Notion の日付のフィルタはタイムゾーンの扱いが分かりにくいので、検索は広めに取り、
// 正確な絞り込み（JST の日付、時間の窓）は呼び出し側がコードで行う。

const TIME_ZONE = "Asia/Tokyo";
const PAGE_SIZE = 100;

export type NotionListedMemo = {
  createdAt: string;
  content: string;
  mediaType: "text" | "url";
  url: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

function tagIs(tag: string) {
  return { property: NOTION_PROPERTY.tag, select: { equals: tag } };
}

function previousDateString(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const previous = new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) - 1),
  );
  return previous.toISOString().slice(0, 10);
}

export function techQueryBody(
  window: { start: Date; end: Date },
  cursor?: string,
) {
  return {
    filter: {
      and: [
        tagIs("tech"),
        {
          property: NOTION_PROPERTY.createdAt,
          date: { on_or_after: window.start.toISOString() },
        },
        {
          property: NOTION_PROPERTY.createdAt,
          date: { before: window.end.toISOString() },
        },
      ],
    },
    page_size: PAGE_SIZE,
    ...(cursor ? { start_cursor: cursor } : {}),
  };
}

export function todoQueryBody(cursor?: string) {
  return {
    filter: tagIs("todo"),
    page_size: PAGE_SIZE,
    ...(cursor ? { start_cursor: cursor } : {}),
  };
}

// 対象日の前後1日まで取る。JST の日付が対象日のものだけを、呼び出し側が残す。
export function scheduleQueryBody(targetDate: string, cursor?: string) {
  return {
    filter: {
      and: [
        tagIs("schedule"),
        {
          property: NOTION_PROPERTY.scheduledAt,
          date: { on_or_after: previousDateString(targetDate) },
        },
        {
          property: NOTION_PROPERTY.scheduledAt,
          date: { on_or_before: nextDateString(targetDate) },
        },
      ],
    },
    page_size: PAGE_SIZE,
    ...(cursor ? { start_cursor: cursor } : {}),
  };
}

// メモIDが一致するページを探す。保存済みかを確かめるだけなので1件で足りる。
export function memoIdQueryBody(memoId: string) {
  return {
    filter: {
      property: NOTION_PROPERTY.memoId,
      rich_text: { equals: memoId },
    },
    page_size: 1,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

type NotionDate = { start: string; timeZone: string | null };

function readDate(property: unknown): NotionDate | null {
  const date = asRecord(asRecord(property)?.date);
  if (!date || typeof date.start !== "string") return null;
  return {
    start: date.start,
    timeZone: typeof date.time_zone === "string" ? date.time_zone : null,
  };
}

// 日時の Notion の値を、時点（Date）にする。日付だけの値は null。
// オフセットが無い値は、time_zone が Asia/Tokyo なら JST、それ以外は UTC として読む。
export function notionInstant(value: NotionDate): Date | null {
  if (DATE_ONLY.test(value.start)) return null;
  const text = HAS_OFFSET.test(value.start)
    ? value.start
    : `${value.start}${value.timeZone === TIME_ZONE ? "+09:00" : "Z"}`;
  const instant = new Date(text);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

// 予定日時の Notion の値を、JST の日付と時刻にする。日付だけなら時刻は null（時間未定）。
export function notionSchedule(
  value: NotionDate,
): { date: string; time: string | null } | null {
  if (DATE_ONLY.test(value.start)) return { date: value.start, time: null };
  const instant = notionInstant(value);
  return instant ? jstDateTime(instant) : null;
}

function readTitle(property: unknown): string {
  const title = asRecord(property)?.title;
  if (!Array.isArray(title)) return "";
  return title
    .map((part) => {
      const text = asRecord(part)?.plain_text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

function readUrl(property: unknown): string | null {
  const url = asRecord(property)?.url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

// 結果のページ1件をメモにする。記録日時が無いページは、ページの作成時刻で代える。
// 本文も日時も読めないページは null（数えない）。
export function toNotionListedMemo(page: unknown): NotionListedMemo | null {
  const record = asRecord(page);
  const properties = asRecord(record?.properties);
  if (!record || !properties) return null;

  const recorded = readDate(properties[NOTION_PROPERTY.createdAt]);
  const createdAt =
    (recorded ? notionInstant(recorded) : null) ??
    (typeof record.created_time === "string"
      ? new Date(record.created_time)
      : null);
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;

  const url = readUrl(properties[NOTION_PROPERTY.url]);
  const content = readTitle(properties[NOTION_PROPERTY.content]);
  if (content.length === 0 && !url) return null;

  const scheduledValue = readDate(properties[NOTION_PROPERTY.scheduledAt]);
  const schedule = scheduledValue ? notionSchedule(scheduledValue) : null;

  return {
    createdAt: createdAt.toISOString(),
    content: content.length > 0 ? content : (url ?? ""),
    mediaType: url ? "url" : "text",
    url,
    scheduledDate: schedule?.date ?? null,
    scheduledTime: schedule?.time ?? null,
  };
}
