import { describe, expect, it } from "vitest";
import {
  buildScheduleDigestMessages,
  DIGEST_TEXT_LIMIT,
  MAX_DIGEST_MESSAGES,
  type ScheduleDigestMemo,
} from "./message";

const APP_URL = "https://memo.example";

function schedule(
  input: Partial<ScheduleDigestMemo> & Pick<ScheduleDigestMemo, "content">,
): ScheduleDigestMemo {
  return {
    createdAt: "2026-11-01T00:00:00.000Z",
    mediaType: "text",
    url: null,
    scheduledTime: null,
    ...input,
  };
}

function build(
  schedules: ScheduleDigestMemo[],
  targetDate = "2026-11-03",
): string[] {
  return buildScheduleDigestMessages({
    schedules,
    targetDate,
    appUrl: APP_URL,
  });
}

describe("buildScheduleDigestMessages: headline", () => {
  it("shows the count and the target date without zero padding", () => {
    expect(build([schedule({ content: "歯医者" })])).toEqual([
      "明日の予定 1件（11/3）\n時間未定 歯医者",
    ]);
    expect(build([schedule({ content: "初詣" })], "2027-01-01")[0]).toMatch(
      /^明日の予定 1件（1\/1）\n/,
    );
    expect(build([schedule({ content: "大掃除" })], "2026-12-31")[0]).toMatch(
      /^明日の予定 1件（12\/31）\n/,
    );
  });

  it("returns no messages for no schedules", () => {
    expect(build([])).toEqual([]);
  });
});

describe("buildScheduleDigestMessages: order", () => {
  it("puts untimed first, then by time, then by creation", () => {
    const messages = build([
      schedule({ content: "十時", scheduledTime: "10:00" }),
      schedule({ content: "一時", scheduledTime: "01:00" }),
      schedule({
        content: "九時・後",
        scheduledTime: "09:00",
        createdAt: "2026-11-01T02:00:00.000Z",
      }),
      schedule({ content: "零時", scheduledTime: "00:00" }),
      schedule({
        content: "未定・後",
        createdAt: "2026-11-01T02:00:00.000Z",
      }),
      schedule({
        content: "九時・先",
        scheduledTime: "09:00",
        createdAt: "2026-11-01T01:00:00.000Z",
      }),
      schedule({
        content: "未定・先",
        createdAt: "2026-11-01T01:00:00.000Z",
      }),
    ]);
    expect(messages).toEqual([
      [
        "明日の予定 7件（11/3）",
        "時間未定 未定・先",
        "時間未定 未定・後",
        "00:00 零時",
        "01:00 一時",
        "09:00 九時・先",
        "09:00 九時・後",
        "10:00 十時",
      ].join("\n"),
    ]);
  });
});

describe("buildScheduleDigestMessages: excerpts", () => {
  it("keeps 200 characters and cuts 201", () => {
    const exact = "あ".repeat(200);
    expect(build([schedule({ content: exact })])[0]).toContain(
      `時間未定 ${exact}`,
    );
    const over = build([schedule({ content: `${exact}い` })])[0];
    expect(over).toContain(`時間未定 ${exact}`);
    expect(over).not.toContain("い");
  });

  it("does not cut a long bare URL but cuts prose containing a URL", () => {
    const url = `https://example.com/${"a".repeat(220)}`;
    expect(build([schedule({ content: url, mediaType: "url" })])[0]).toContain(
      `時間未定 ${url}`,
    );
    const prose = `会場 ${url}`;
    expect(build([schedule({ content: prose })])[0]).toContain(
      `時間未定 ${prose.slice(0, 200)}`,
    );
    expect(build([schedule({ content: prose })])[0]).not.toContain(url);
  });
});

describe("buildScheduleDigestMessages: limits", () => {
  const urlSchedule = (i: number) =>
    schedule({
      content: `https://example.com/${i}`,
      mediaType: "url",
      scheduledTime: "10:00",
    });

  it("splits after five URL previews", () => {
    expect(
      build(Array.from({ length: 5 }, (_, i) => urlSchedule(i))),
    ).toHaveLength(1);
    expect(
      build(Array.from({ length: 6 }, (_, i) => urlSchedule(i))),
    ).toHaveLength(2);
  });

  it("keeps exactly DIGEST_TEXT_LIMIT characters in one message", () => {
    // 見出し（15文字）+ 24行 × (改行 + "10:00 " + 200文字) + 改行 + "10:00 " + 本文
    const full = Array.from({ length: 24 }, () =>
      schedule({ content: "あ".repeat(200), scheduledTime: "10:00" }),
    );
    const exact = build([
      ...full,
      schedule({ content: "い".repeat(10), scheduledTime: "10:00" }),
    ]);
    expect(exact).toHaveLength(1);
    expect(exact[0]).toHaveLength(DIGEST_TEXT_LIMIT);

    const over = build([
      ...full,
      schedule({ content: "い".repeat(11), scheduledTime: "10:00" }),
    ]);
    expect(over).toHaveLength(2);
  });

  it("fits exactly five messages and overflows the sixth into a footer", () => {
    const fits = build(Array.from({ length: 25 }, (_, i) => urlSchedule(i)));
    expect(fits).toHaveLength(MAX_DIGEST_MESSAGES);
    expect(fits.join("\n")).not.toContain("Web で");

    const overflow = build(
      Array.from({ length: 26 }, (_, i) => urlSchedule(i)),
    );
    expect(overflow).toHaveLength(MAX_DIGEST_MESSAGES);
    expect(overflow[0]).toMatch(/^明日の予定 26件（11\/3）/);
    expect(overflow[MAX_DIGEST_MESSAGES - 1]).toContain(
      `他2件は Web で\n${APP_URL}`,
    );
  });
});
