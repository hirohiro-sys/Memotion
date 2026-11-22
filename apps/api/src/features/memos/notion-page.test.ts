import { describe, expect, it } from "vitest";
import {
  buildNotionPage,
  type NotionMemo,
  splitNotionText,
} from "./notion-page";

const textMemo: NotionMemo = {
  id: "3f2b9c1e-1111-4222-8333-444455556666",
  tag: "tweet",
  content: "眠い",
  mediaType: "text",
  source: "web",
  createdAt: "2026-11-22T00:30:15.000Z",
};

describe("buildNotionPage", () => {
  it("maps a text memo to the database properties", () => {
    expect(buildNotionPage(textMemo, "ds_1")).toEqual({
      parent: { type: "data_source_id", data_source_id: "ds_1" },
      properties: {
        本文: { title: [{ type: "text", text: { content: "眠い" } }] },
        種類: { select: { name: "tweet" } },
        入力元: { select: { name: "web" } },
        メモID: {
          rich_text: [
            {
              type: "text",
              text: { content: "3f2b9c1e-1111-4222-8333-444455556666" },
            },
          ],
        },
        記録日時: {
          date: { start: "2026-11-22T09:30:15", time_zone: "Asia/Tokyo" },
        },
      },
    });
  });

  it("puts a URL memo into the URL property and a bookmark block", () => {
    const page = buildNotionPage(
      {
        ...textMemo,
        content: "https://example.com/a",
        mediaType: "url",
        source: "line",
      },
      "ds_1",
    );

    expect(page.properties.URL).toEqual({ url: "https://example.com/a" });
    expect(page.properties.入力元).toEqual({ select: { name: "line" } });
    expect(page.children).toEqual([
      {
        object: "block",
        type: "bookmark",
        bookmark: { url: "https://example.com/a" },
      },
    ]);
  });

  it("leaves out the URL property and children for a text memo", () => {
    const page = buildNotionPage(textMemo, "ds_1");

    expect(page.properties).not.toHaveProperty("URL");
    expect(page).not.toHaveProperty("children");
  });

  it("writes a schedule with a time as a JST datetime", () => {
    const page = buildNotionPage(
      {
        ...textMemo,
        tag: "schedule",
        scheduledDate: "2026-11-30",
        scheduledTime: "09:05",
      },
      "ds_1",
    );

    expect(page.properties.予定日時).toEqual({
      date: { start: "2026-11-30T09:05:00", time_zone: "Asia/Tokyo" },
    });
  });

  it("writes a schedule without a time as a date only", () => {
    const page = buildNotionPage(
      { ...textMemo, tag: "schedule", scheduledDate: "2026-11-30" },
      "ds_1",
    );

    expect(page.properties.予定日時).toEqual({
      date: { start: "2026-11-30" },
    });
  });

  it("ignores a scheduled date on a memo that is not a schedule", () => {
    const page = buildNotionPage(
      { ...textMemo, tag: "todo", scheduledDate: "2026-11-30" },
      "ds_1",
    );

    expect(page.properties).not.toHaveProperty("予定日時");
  });

  it("leaves out the recorded time when createdAt cannot be read", () => {
    const page = buildNotionPage(
      { ...textMemo, createdAt: "not a date" },
      "ds_1",
    );

    expect(page.properties).not.toHaveProperty("記録日時");
  });
});

describe("splitNotionText", () => {
  it("keeps a text of exactly 2000 characters in one object", () => {
    const parts = splitNotionText("a".repeat(2000));

    expect(parts).toHaveLength(1);
    expect(parts[0]?.text.content).toHaveLength(2000);
  });

  it("splits a text of 2001 characters into two objects", () => {
    const parts = splitNotionText("a".repeat(2001));

    expect(parts.map((part) => part.text.content.length)).toEqual([2000, 1]);
  });

  it("does not cut a surrogate pair at the boundary", () => {
    const parts = splitNotionText(`${"a".repeat(1999)}😀b`);

    expect(parts.map((part) => part.text.content)).toEqual([
      "a".repeat(1999),
      "😀b",
    ]);
  });

  it("drops text beyond 100 objects", () => {
    const parts = splitNotionText("a".repeat(2000 * 100 + 1));

    expect(parts).toHaveLength(100);
  });

  it("returns no objects for an empty text", () => {
    expect(splitNotionText("")).toEqual([]);
  });
});
