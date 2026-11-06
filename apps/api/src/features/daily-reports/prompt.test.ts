import { describe, expect, it } from "vitest";
import { buildPrompt, type PromptMemo } from "./prompt";

const created = "2026-10-29T00:30:00.000Z";

function memo(
  overrides: Partial<PromptMemo> & Pick<PromptMemo, "id">,
): PromptMemo {
  return {
    content: "本文",
    createdAt: created,
    url: null,
    tag: "tweet",
    scheduledDate: null,
    scheduledTime: null,
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("includes the JST time, the body, and the url, and omits the image key", () => {
    const result = buildPrompt("log", [
      memo({
        id: "m1",
        content: "散歩した",
        url: "https://example.com/note",
      }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain("作成日時: 2026-10-29 09:30");
    expect(result.text).toContain("散歩した");
    expect(result.text).toContain("URL: https://example.com/note");
    expect(result.text).not.toContain("image-key-sentinel");
    expect(result.text).toContain("要約");
    expect(result.text).toContain("写さず");
    expect(result.text).toContain("箇条書き");
    expect(result.text).toContain("時刻ごと");
    expect(result.text).toContain("先頭行は書かないでください");
  });

  it("adds the schedule date and an unset time only for schedule memos", () => {
    const result = buildPrompt("achievement", [
      memo({
        id: "m1",
        tag: "schedule",
        scheduledDate: "2026-11-01",
        scheduledTime: null,
      }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain("予定日: 2026-11-01");
    expect(result.text).toContain("予定時刻: 時間未定");
    expect(result.text).toContain("要約");
    expect(result.text).toContain("写さず");
    expect(result.text).toContain("やったこと");
    expect(result.text).toContain("気づき");
    expect(result.text).toContain("次にやること");
    expect(result.text).toContain("先頭行は書かないでください");
  });

  it("orders memos by created time, then by id", () => {
    const result = buildPrompt("log", [
      memo({ id: "m-b", content: "later-id", createdAt: created }),
      memo({
        id: "m-z",
        content: "earlier",
        createdAt: "2026-10-28T00:00:00.000Z",
      }),
      memo({ id: "m-a", content: "earlier-id", createdAt: created }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const earlier = result.text.indexOf("earlier");
    const earlierId = result.text.indexOf("earlier-id");
    const laterId = result.text.indexOf("later-id");
    expect(earlier).toBeGreaterThanOrEqual(0);
    expect(earlier).toBeLessThan(earlierId);
    expect(earlierId).toBeLessThan(laterId);
  });

  it("refuses a memo whose created time cannot be parsed", () => {
    expect(
      buildPrompt("log", [memo({ id: "m1", createdAt: "not-a-date" })]),
    ).toEqual({ ok: false, reason: "unparsed_time" });
  });

  it("refuses a created time that Date cannot represent after the JST shift", () => {
    expect(
      buildPrompt("log", [
        memo({ id: "m1", createdAt: "+275760-09-13T00:00:00Z" }),
      ]),
    ).toEqual({ ok: false, reason: "unparsed_time" });
  });
});
