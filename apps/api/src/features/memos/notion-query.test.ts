import { describe, expect, it } from "vitest";
import {
  notionInstant,
  notionSchedule,
  scheduleQueryBody,
  techQueryBody,
  todoQueryBody,
  toNotionListedMemo,
} from "./notion-query";

function page(properties: Record<string, unknown>, createdTime?: string) {
  return {
    object: "page",
    ...(createdTime ? { created_time: createdTime } : {}),
    properties,
  };
}

const title = (text: string) => ({
  title: [{ type: "text", plain_text: text }],
});
const date = (start: string, timeZone: string | null = null) => ({
  date: { start, end: null, time_zone: timeZone },
});

describe("query bodies", () => {
  it("filters tech by the recorded time within the window", () => {
    expect(
      techQueryBody({
        start: new Date("2026-11-15T11:00:00.000Z"),
        end: new Date("2026-11-22T11:00:00.000Z"),
      }),
    ).toEqual({
      filter: {
        and: [
          { property: "種類", select: { equals: "tech" } },
          {
            property: "記録日時",
            date: { on_or_after: "2026-11-15T11:00:00.000Z" },
          },
          {
            property: "記録日時",
            date: { before: "2026-11-22T11:00:00.000Z" },
          },
        ],
      },
      page_size: 100,
    });
  });

  it("filters todo by its kind and passes the cursor for the next page", () => {
    expect(todoQueryBody("cursor_1")).toEqual({
      filter: { property: "種類", select: { equals: "todo" } },
      page_size: 100,
      start_cursor: "cursor_1",
    });
  });

  it("widens the schedule date by a day on both sides, across a month end", () => {
    expect(scheduleQueryBody("2026-12-01").filter.and.slice(1)).toEqual([
      { property: "予定日時", date: { on_or_after: "2026-11-30" } },
      { property: "予定日時", date: { on_or_before: "2026-12-02" } },
    ]);
  });
});

describe("notionInstant", () => {
  it("reads a value with an offset as is", () => {
    expect(
      notionInstant({ start: "2026-11-23T09:30:00.000+09:00", timeZone: null }),
    ).toEqual(new Date("2026-11-23T00:30:00.000Z"));
  });

  it("reads a value without an offset as JST when the time zone is Asia/Tokyo", () => {
    expect(
      notionInstant({ start: "2026-11-23T09:30:00", timeZone: "Asia/Tokyo" }),
    ).toEqual(new Date("2026-11-23T00:30:00.000Z"));
  });

  it("reads a value without an offset or a time zone as UTC", () => {
    expect(
      notionInstant({ start: "2026-11-23T09:30:00", timeZone: null }),
    ).toEqual(new Date("2026-11-23T09:30:00.000Z"));
  });

  it("returns null for a date without a time or an unreadable value", () => {
    expect(notionInstant({ start: "2026-11-23", timeZone: null })).toBeNull();
    expect(notionInstant({ start: "soon", timeZone: null })).toBeNull();
  });
});

describe("notionSchedule", () => {
  it("keeps a date-only schedule as having no time", () => {
    expect(notionSchedule({ start: "2026-11-24", timeZone: null })).toEqual({
      date: "2026-11-24",
      time: null,
    });
  });

  it("moves a UTC instant to its JST date and time", () => {
    expect(
      notionSchedule({
        start: "2026-11-23T15:30:00.000+00:00",
        timeZone: null,
      }),
    ).toEqual({ date: "2026-11-24", time: "00:30" });
  });
});

describe("toNotionListedMemo", () => {
  it("reads the title, the recorded time, and the schedule", () => {
    expect(
      toNotionListedMemo(
        page({
          本文: title("歯医者"),
          記録日時: date("2026-11-23T08:00:00.000+09:00"),
          予定日時: date("2026-11-24T09:30:00.000+09:00"),
          URL: { url: null },
        }),
      ),
    ).toEqual({
      createdAt: "2026-11-22T23:00:00.000Z",
      content: "歯医者",
      mediaType: "text",
      url: null,
      scheduledDate: "2026-11-24",
      scheduledTime: "09:30",
    });
  });

  it("joins a title split into several parts", () => {
    const memo = toNotionListedMemo(
      page({
        本文: {
          title: [
            { type: "text", plain_text: "前半" },
            { type: "text", plain_text: "後半" },
          ],
        },
        記録日時: date("2026-11-23T08:00:00.000+09:00"),
      }),
    );
    expect(memo?.content).toBe("前半後半");
  });

  it("treats a page with a URL as a URL memo", () => {
    const memo = toNotionListedMemo(
      page({
        本文: title("https://example.com"),
        記録日時: date("2026-11-23T08:00:00.000+09:00"),
        URL: { url: "https://example.com" },
      }),
    );
    expect(memo?.mediaType).toBe("url");
    expect(memo?.url).toBe("https://example.com");
  });

  it("falls back to the page's creation time without a recorded time", () => {
    const memo = toNotionListedMemo(
      page({ 本文: title("手で足した") }, "2026-11-23T01:00:00.000Z"),
    );
    expect(memo?.createdAt).toBe("2026-11-23T01:00:00.000Z");
  });

  it("skips a page with neither a body nor a URL, or without any time", () => {
    expect(
      toNotionListedMemo(
        page({ 本文: title(""), 記録日時: date("2026-11-23T08:00:00Z") }),
      ),
    ).toBeNull();
    expect(toNotionListedMemo(page({ 本文: title("時刻なし") }))).toBeNull();
    expect(toNotionListedMemo(null)).toBeNull();
  });
});
