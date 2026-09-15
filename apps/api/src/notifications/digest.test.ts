import { describe, expect, it } from "vitest";
import { decideUserDigest, settingsAfterPush } from "./digest";
import type { DigestMemo } from "./message";
import { DEFAULT_TECH_WEEKLY, UNREACHABLE_DISABLED_REASON } from "./settings";

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

const now = jst(2026, 9, 13, 20, 7);
const appUrl = "https://memo.example";

function memo(createdAt: string, content = "記事"): DigestMemo {
  return { createdAt, content, mediaType: "text", url: null };
}

describe("decideUserDigest", () => {
  it("skips a disabled user", () => {
    expect(
      decideUserDigest({
        settings: { ...DEFAULT_TECH_WEEKLY, enabled: false },
        now,
        memos: [memo(jst(2026, 9, 10, 12, 0).toISOString())],
        appUrl,
      }),
    ).toEqual({ action: "skip", reason: "disabled" });
  });

  it("skips when the latest slot is already sent", () => {
    expect(
      decideUserDigest({
        settings: {
          ...DEFAULT_TECH_WEEKLY,
          lastSentAt: jst(2026, 9, 13, 20, 1).toISOString(),
        },
        now,
        memos: [memo(jst(2026, 9, 10, 12, 0).toISOString())],
        appUrl,
      }),
    ).toEqual({ action: "skip", reason: "not_due" });
  });

  it("skips an empty due window without treating it as sent", () => {
    expect(
      decideUserDigest({
        settings: DEFAULT_TECH_WEEKLY,
        now,
        memos: [memo(jst(2026, 9, 13, 20, 0).toISOString())],
        appUrl,
      }),
    ).toEqual({ action: "skip", reason: "empty" });
  });

  it("builds a push for due tech memos in the current window", () => {
    const decision = decideUserDigest({
      settings: DEFAULT_TECH_WEEKLY,
      now,
      memos: [memo(jst(2026, 9, 10, 12, 0).toISOString(), "Rust")],
      appUrl,
    });
    expect(decision.action).toBe("push");
    if (decision.action !== "push") return;
    expect(decision.texts).toHaveLength(1);
    expect(decision.texts[0]).toContain("今週のTech 1件");
    expect(decision.texts[0]).toContain("Rust");
    expect(decision.window).toEqual({
      start: jst(2026, 9, 6, 20, 0),
      end: jst(2026, 9, 13, 20, 0),
    });
  });
});

describe("settingsAfterPush", () => {
  it("writes last_sent_at on success and does not write on transient", () => {
    expect(
      settingsAfterPush(DEFAULT_TECH_WEEKLY, "success", now)?.lastSentAt,
    ).toBe(now.toISOString());
    expect(settingsAfterPush(DEFAULT_TECH_WEEKLY, "transient", now)).toBeNull();
  });

  it("turns the toggle off with the fixed reason when the user is unreachable", () => {
    expect(settingsAfterPush(DEFAULT_TECH_WEEKLY, "unreachable", now)).toEqual({
      ...DEFAULT_TECH_WEEKLY,
      enabled: false,
      disabledReason: UNREACHABLE_DISABLED_REASON,
    });
  });
});
