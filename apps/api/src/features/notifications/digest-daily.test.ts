import { describe, expect, it } from "vitest";
import { decideTodoDailyDigest } from "./digest";
import type { DigestMemo } from "./message";
import { DEFAULT_TODO_DAILY } from "./settings";

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

const now = jst(2026, 9, 15, 8, 7);
const appUrl = "https://memo.example";

function memo(createdAt: string, content: string): DigestMemo {
  return { createdAt, content, mediaType: "text", url: null };
}

describe("decideTodoDailyDigest: 今送るか", () => {
  it("オフなら送らない", () => {
    expect(
      decideTodoDailyDigest({
        settings: { ...DEFAULT_TODO_DAILY, enabled: false },
        now,
        memos: [memo(jst(2026, 9, 10, 12, 0).toISOString(), "買う")],
        appUrl,
      }),
    ).toEqual({ action: "skip", reason: "disabled" });
  });

  it("今日の08:00以降に送済みなら送らない", () => {
    expect(
      decideTodoDailyDigest({
        settings: {
          ...DEFAULT_TODO_DAILY,
          lastSentAt: jst(2026, 9, 15, 8, 1).toISOString(),
        },
        now,
        memos: [memo(jst(2026, 9, 10, 12, 0).toISOString(), "買う")],
        appUrl,
      }),
    ).toEqual({ action: "skip", reason: "not_due" });
  });

  it("TODOが0件なら送らず、lastSentAtは進めない", () => {
    expect(
      decideTodoDailyDigest({
        settings: DEFAULT_TODO_DAILY,
        now,
        memos: [],
        appUrl,
      }),
    ).toEqual({ action: "skip", reason: "empty" });
  });
});

describe("decideTodoDailyDigest: 全件スナップショット", () => {
  it("古いTODOも新しいTODOも文面に入り、見出しは未完了のTODO N件", () => {
    const decision = decideTodoDailyDigest({
      settings: DEFAULT_TODO_DAILY,
      now,
      memos: [
        memo(jst(2026, 1, 2, 9, 0).toISOString(), "古い"),
        memo(jst(2026, 9, 14, 21, 0).toISOString(), "新しい"),
      ],
      appUrl,
    });
    expect(decision.action).toBe("push");
    if (decision.action !== "push") return;
    expect(decision.texts.join("\n")).toContain("未完了のTODO 2件");
    expect(decision.texts.join("\n")).toContain("古い");
    expect(decision.texts.join("\n")).toContain("新しい");
  });
});
