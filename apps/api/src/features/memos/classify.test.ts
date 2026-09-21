import { describe, expect, it } from "vitest";
import { classify, IMAGE_CONTENT, replyTextFor } from "./classify";

describe("classify: leading permitted tags", () => {
  it("splits #tweet followed by Japanese into tweet and body", () => {
    expect(classify({ text: "#tweet眠い" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "text",
      content: "眠い",
    });
  });

  it("strips a leading tag and surrounding space", () => {
    expect(classify({ text: "#tech この記事" })).toEqual({
      save: true,
      tag: "tech",
      mediaType: "text",
      content: "この記事",
    });
  });

  it("accepts fullwidth sharp and ignores case", () => {
    expect(classify({ text: "＃TWEET 眠い" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "text",
      content: "眠い",
    });
  });

  it("keeps tag and mediaType independent when a tagged message is a URL", () => {
    expect(classify({ text: "#tweet https://example.com" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "url",
      content: "https://example.com",
    });
  });

  it("saves #tech plus prose as tech/text", () => {
    expect(classify({ text: "#tech 眠い" })).toEqual({
      save: true,
      tag: "tech",
      mediaType: "text",
      content: "眠い",
    });
  });

  it("saves #todo plus prose as todo/text", () => {
    expect(classify({ text: "#todo 買う" })).toEqual({
      save: true,
      tag: "todo",
      mediaType: "text",
      content: "買う",
    });
  });

  it("treats a mid-text or trailing #tech as body, not a tag", () => {
    expect(classify({ text: "今日のメモ #tech" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "text",
      content: "今日のメモ #tech",
    });
  });
});

describe("classify: unknown tags and collisions", () => {
  it("rejects #tweets as an unknown tag, not tweet", () => {
    expect(classify({ text: "#tweets" })).toEqual({
      save: false,
      reason: "unknown_tag",
    });
  });

  it("rejects a permitted tag followed by ASCII alphanumerics", () => {
    expect(classify({ text: "#tweet1 本文" })).toEqual({
      save: false,
      reason: "unknown_tag",
    });
  });

  it("rejects an unknown leading hashtag", () => {
    expect(classify({ text: "#work 買う" })).toEqual({
      save: false,
      reason: "unknown_tag",
    });
  });

  it("rejects two permitted tags at the start", () => {
    expect(classify({ text: "#tweet #tech 本文" })).toEqual({
      save: false,
      reason: "unknown_tag",
    });
  });

  it("rejects concatenated leading permitted tags", () => {
    expect(classify({ text: "#tweet#tech 本文" })).toEqual({
      save: false,
      reason: "unknown_tag",
    });
  });
});

describe("classify: empty bodies", () => {
  it("rejects whitespace-only text", () => {
    expect(classify({ text: "   " })).toEqual({
      save: false,
      reason: "empty",
    });
  });

  it("rejects missing text", () => {
    expect(classify({})).toEqual({
      save: false,
      reason: "empty",
    });
  });

  it("rejects a leading tag that leaves no body", () => {
    expect(classify({ text: "#other" })).toEqual({
      save: false,
      reason: "empty_after_tag",
    });
  });

  it("rejects a leading tag followed by only whitespace", () => {
    expect(classify({ text: "#tweet   " })).toEqual({
      save: false,
      reason: "empty_after_tag",
    });
  });
});

describe("classify: untagged text, URLs, and images", () => {
  it("classifies a bare URL as tech/url and keeps that URL as content", () => {
    expect(classify({ text: "https://example.com/path?q=1" })).toEqual({
      save: true,
      tag: "tech",
      mediaType: "url",
      content: "https://example.com/path?q=1",
    });
  });

  it("classifies http URLs the same way", () => {
    expect(classify({ text: "http://example.com" })).toEqual({
      save: true,
      tag: "tech",
      mediaType: "url",
      content: "http://example.com",
    });
  });

  it("classifies prose plus a URL as tweet/text", () => {
    expect(classify({ text: "これ見て https://example.com" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "text",
      content: "これ見て https://example.com",
    });
  });

  it("classifies ordinary text as tweet/text", () => {
    expect(classify({ text: "  眠い  " })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "text",
      content: "眠い",
    });
  });

  it("classifies images as other/image regardless of text", () => {
    expect(classify({ isImage: true, text: "#tweet 無視" })).toEqual({
      save: true,
      tag: "other",
      mediaType: "image",
      content: IMAGE_CONTENT,
    });
  });
});

describe("replyTextFor", () => {
  it("maps each fail reason to the fixed LINE reply", () => {
    expect(replyTextFor("unsupported")).toBe(
      "この形式は保存できません。テキスト（URL含む）か画像を送信してください。",
    );
    expect(replyTextFor("unknown_tag")).toBe(
      "使えるタグは #tweet #tech #todo #other です。",
    );
    expect(replyTextFor("empty_after_tag")).toBe(
      "本文が空です。タグのあとにテキスト（URL含む）か画像を送ってください。",
    );
    expect(replyTextFor("empty")).toBe(
      "本文が空です。テキスト（URL含む）か画像を送ってください。",
    );
    expect(replyTextFor("save_failed")).toBe(
      "保存できませんでした。もう一度送ってください。",
    );
  });
});
