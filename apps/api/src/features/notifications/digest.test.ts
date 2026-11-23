import { describe, expect, it } from "vitest";
import {
  buildTechWeeklyTexts,
  buildTodoDailyTexts,
  decideTechWeekly,
  decideTodoDaily,
  shouldRecordAfterPush,
} from "./digest";
import type { DigestMemo } from "./message";

function jst(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - 9 * 60 * 60 * 1000,
  );
}

const SUNDAY_20 = { weekday: 0, time: "20:00" };
const DAILY_08 = { time: "08:00" };
const linkUrl = "https://www.notion.so/memos";

function memo(createdAt: string, content = "記事"): DigestMemo {
  return { createdAt, content, mediaType: "text", url: null };
}

describe("decideTechWeekly", () => {
  const now = jst(2026, 9, 13, 20, 7);

  it("records a baseline without sending when nothing was sent before", () => {
    expect(
      decideTechWeekly({ slot: SUNDAY_20, now, lastSentAt: null }),
    ).toEqual({ action: "baseline" });
  });

  it("waits when the latest slot is already sent", () => {
    expect(
      decideTechWeekly({
        slot: SUNDAY_20,
        now,
        lastSentAt: jst(2026, 9, 13, 20, 1).toISOString(),
      }),
    ).toEqual({ action: "not_due" });
  });

  it("is due with the week ending at the latest slot when sent before it", () => {
    expect(
      decideTechWeekly({
        slot: SUNDAY_20,
        now,
        lastSentAt: jst(2026, 9, 13, 19, 59).toISOString(),
      }),
    ).toEqual({
      action: "due",
      window: { start: jst(2026, 9, 6, 20, 0), end: jst(2026, 9, 13, 20, 0) },
    });
  });

  it("is not due one minute before the slot", () => {
    expect(
      decideTechWeekly({
        slot: SUNDAY_20,
        now: jst(2026, 9, 13, 19, 59),
        lastSentAt: jst(2026, 9, 6, 20, 0).toISOString(),
      }),
    ).toEqual({ action: "not_due" });
  });
});

describe("decideTodoDaily", () => {
  it("records a baseline without sending when nothing was sent before", () => {
    expect(
      decideTodoDaily({
        slot: DAILY_08,
        now: jst(2026, 9, 14, 8, 0),
        lastSentAt: null,
      }),
    ).toEqual({ action: "baseline" });
  });

  it("is due at 08:00 when the last send was yesterday", () => {
    expect(
      decideTodoDaily({
        slot: DAILY_08,
        now: jst(2026, 9, 14, 8, 0),
        lastSentAt: jst(2026, 9, 13, 8, 0).toISOString(),
      }),
    ).toEqual({ action: "due" });
  });

  it("waits when today's 08:00 is already sent", () => {
    expect(
      decideTodoDaily({
        slot: DAILY_08,
        now: jst(2026, 9, 14, 21, 0),
        lastSentAt: jst(2026, 9, 14, 8, 0).toISOString(),
      }),
    ).toEqual({ action: "not_due" });
  });
});

describe("buildTechWeeklyTexts", () => {
  it("heads the message with the count and the window and links to Notion on overflow", () => {
    const texts = buildTechWeeklyTexts({
      memos: [memo(jst(2026, 9, 10, 12, 0).toISOString(), "Rust")],
      window: { start: jst(2026, 9, 6, 20, 0), end: jst(2026, 9, 13, 20, 0) },
      linkUrl,
    });
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("今週のTech 1件");
    expect(texts[0]).toContain("Rust");
  });

  it("sends nothing for no memos", () => {
    expect(
      buildTechWeeklyTexts({
        memos: [],
        window: { start: jst(2026, 9, 6, 20, 0), end: jst(2026, 9, 13, 20, 0) },
        linkUrl,
      }),
    ).toEqual([]);
  });
});

describe("buildTodoDailyTexts", () => {
  it("lists old and new todos under the count", () => {
    const text = buildTodoDailyTexts({
      memos: [
        memo(jst(2026, 1, 2, 9, 0).toISOString(), "古い"),
        memo(jst(2026, 9, 14, 21, 0).toISOString(), "新しい"),
      ],
      linkUrl,
    }).join("\n");
    expect(text).toContain("未完了のTODO 2件");
    expect(text).toContain("古い");
    expect(text).toContain("新しい");
  });

  it("sends nothing for no todos", () => {
    expect(buildTodoDailyTexts({ memos: [], linkUrl })).toEqual([]);
  });
});

describe("shouldRecordAfterPush", () => {
  it("records a success and an unreachable user, and retries a transient failure", () => {
    expect(shouldRecordAfterPush("success")).toBe(true);
    expect(shouldRecordAfterPush("unreachable")).toBe(true);
    expect(shouldRecordAfterPush("transient")).toBe(false);
  });
});
