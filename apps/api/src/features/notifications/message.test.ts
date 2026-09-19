import { describe, expect, it } from "vitest";
import {
  buildDigestMessages,
  DIGEST_TEXT_LIMIT,
  type DigestMemo,
  MAX_URL_PREVIEWS_PER_MESSAGE,
} from "./message";

const APP_URL = "https://memo.example";
const windowStart = new Date("2026-09-06T11:00:00.000Z");
const windowEnd = new Date("2026-09-13T11:00:00.000Z");

function memo(
  input: Partial<DigestMemo> & Pick<DigestMemo, "content">,
): DigestMemo {
  return {
    createdAt: "2026-09-08T00:00:00.000Z",
    mediaType: "text",
    url: null,
    ...input,
  };
}

function build(memos: DigestMemo[], appUrl = APP_URL): string[] {
  return buildDigestMessages({
    memos,
    windowStart,
    windowEnd,
    appUrl,
  });
}

describe("buildDigestMessages: empty and order", () => {
  it("returns no messages for an empty week", () => {
    expect(build([])).toEqual([]);
  });

  it("sorts memos oldest first", () => {
    const messages = build([
      memo({ content: "新しい", createdAt: "2026-09-10T00:00:00.000Z" }),
      memo({ content: "古い", createdAt: "2026-09-07T00:00:00.000Z" }),
    ]);
    expect(messages).toHaveLength(1);
    const headline = messages[0] ?? "";
    expect(headline).toContain("9/7 古い");
    expect(headline).toContain("9/10 新しい");
    expect(headline.indexOf("9/7 古い")).toBeLessThan(
      headline.indexOf("9/10 新しい"),
    );
  });
});

describe("buildDigestMessages: headline and lines", () => {
  it("puts count and JST period on the first message", () => {
    const messages = build([
      memo({ content: "記事A" }),
      memo({ content: "記事B", createdAt: "2026-09-09T00:00:00.000Z" }),
    ]);
    expect(messages).toEqual([
      [
        "今週のTech 2件（9/6 20:00 〜 9/13 20:00）",
        "9/8 記事A",
        "9/9 記事B",
      ].join("\n"),
    ]);
  });

  it("does not attach a Web link when the week fits", () => {
    const messages = build([memo({ content: "短い" })]);
    expect(messages.join("\n")).not.toContain("Web");
    expect(messages.join("\n")).not.toContain(APP_URL);
  });

  it("formats M/D without leading zeros", () => {
    const messages = build([
      memo({ content: "境界", createdAt: "2026-09-07T01:00:00.000Z" }),
    ]);
    expect(messages[0]).toContain("9/7 境界");
  });
});

describe("buildDigestMessages: URL vs text", () => {
  it("keeps a URL in content when mediaType is url and url is null", () => {
    const url = `https://example.com/${"a".repeat(300)}`;
    const messages = build([
      memo({ content: url, mediaType: "url", url: null }),
    ]);
    expect(messages[0]).toContain(url);
  });

  it("prefers the url column over content", () => {
    const messages = build([
      memo({
        content: "https://stale.example",
        mediaType: "text",
        url: "https://canonical.example/path",
      }),
    ]);
    expect(messages[0]).toContain("https://canonical.example/path");
    expect(messages[0]).not.toContain("https://stale.example");
  });

  it("excerpts text to 200 characters", () => {
    const body = "あ".repeat(250);
    const messages = build([memo({ content: body })]);
    expect(messages[0]).toContain(`9/8 ${"あ".repeat(200)}`);
    expect(messages[0]).not.toContain("あ".repeat(201));
  });

  it("treats an image memo as text excerpt", () => {
    const messages = build([memo({ content: "（画像）", mediaType: "image" })]);
    expect(messages[0]).toContain("9/8 （画像）");
  });
});

describe("buildDigestMessages: overflow", () => {
  it("splits on memo boundaries up to 5 messages, then points to Web", () => {
    const longUrl = `https://example.com/${"u".repeat(2400)}`;
    const memos = Array.from({ length: 12 }, (_, index) =>
      memo({
        content: longUrl,
        mediaType: "url",
        createdAt: new Date(
          Date.parse("2026-09-07T00:00:00.000Z") + index * 60_000,
        ).toISOString(),
      }),
    );

    const messages = build(memos);
    expect(messages).toHaveLength(5);
    expect(messages.every((text) => text.length <= DIGEST_TEXT_LIMIT)).toBe(
      true,
    );
    expect(
      (messages[0] ?? "").startsWith(
        "今週のTech 12件（9/6 20:00 〜 9/13 20:00）",
      ),
    ).toBe(true);
    expect(messages.join("\n")).toContain("他2件は Web で");
    expect(messages[4]).toContain(APP_URL);
    expect(messages.slice(0, 4).join("\n")).not.toContain(APP_URL);
  });

  it("does not cut a URL to squeeze it into a full message", () => {
    const url = `https://example.com/${"b".repeat(4000)}`;
    const messages = build([
      memo({ content: url, mediaType: "url" }),
      memo({
        content: url,
        mediaType: "url",
        createdAt: "2026-09-09T00:00:00.000Z",
      }),
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain(url);
    expect(messages[1]).toBe(`9/9 ${url}`);
    expect(messages.every((text) => text.length <= DIGEST_TEXT_LIMIT)).toBe(
      true,
    );
  });
});

function urlMemos(count: number): DigestMemo[] {
  return Array.from({ length: count }, (_, index) =>
    memo({
      content: `https://example.com/${index}`,
      mediaType: "url",
      createdAt: new Date(
        Date.parse("2026-09-07T00:00:00.000Z") + index * 60_000,
      ).toISOString(),
    }),
  );
}

function httpUrls(text: string): string[] {
  return text.match(/https?:\/\/\S+/g) ?? [];
}

describe("buildDigestMessages: URL preview packing", () => {
  it("starts a new message after 5 URL previews", () => {
    const messages = build(urlMemos(6));
    expect(messages).toHaveLength(2);
    expect(httpUrls(messages[0] ?? "")).toHaveLength(
      MAX_URL_PREVIEWS_PER_MESSAGE,
    );
    expect(httpUrls(messages[1] ?? "")).toHaveLength(1);
    expect(messages.join("\n")).not.toContain("Web");
    expect(messages.join("\n")).toContain("https://example.com/0");
    expect(messages.join("\n")).toContain("https://example.com/5");
  });

  it("does not split text-only memos on the preview limit", () => {
    const memos = Array.from({ length: 8 }, (_, index) =>
      memo({
        content: `メモ${index}`,
        createdAt: new Date(
          Date.parse("2026-09-07T00:00:00.000Z") + index * 60_000,
        ).toISOString(),
      }),
    );
    const messages = build(memos);
    expect(messages).toHaveLength(1);
    expect(messages.join("\n")).not.toContain("Web");
  });

  it("keeps the overflow Web URL within the preview budget", () => {
    const messages = build(urlMemos(26));
    expect(messages).toHaveLength(5);
    expect(
      messages.every(
        (text) => httpUrls(text).length <= MAX_URL_PREVIEWS_PER_MESSAGE,
      ),
    ).toBe(true);
    expect(messages.join("\n")).toContain("他2件は Web で");
    expect(messages[4]).toContain(APP_URL);
    expect(messages.slice(0, 4).join("\n")).not.toContain(APP_URL);
    expect(httpUrls(messages[4] ?? "")).toContain(APP_URL);
  });
});
