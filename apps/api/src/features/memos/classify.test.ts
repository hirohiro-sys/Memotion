import { describe, expect, it } from "vitest";
import { classify, IMAGE_CONTENT, replyTextFor } from "./classify";

describe("classify: every LINE message is saved as tweet", () => {
  it("classifies ordinary text as tweet/text and trims it", () => {
    expect(classify({ text: "  眠い  " })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "text",
      content: "眠い",
    });
  });

  it("classifies a bare URL as tweet/url and keeps that URL as content", () => {
    expect(classify({ text: "https://example.com/path?q=1" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "url",
      content: "https://example.com/path?q=1",
    });
    expect(classify({ text: "http://example.com" })).toEqual({
      save: true,
      tag: "tweet",
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

  it("classifies images as tweet/image regardless of text", () => {
    expect(classify({ isImage: true, text: "#tech 無視" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "image",
      content: IMAGE_CONTENT,
    });
  });
});

describe("classify: leading hashtags are body text, not tags", () => {
  it.each([
    "#tech メモ",
    "#tweet眠い",
    "＃todo やる",
    "#other",
    "#unknown",
    "#tweet #tech 本文",
    "#schedule 11/3 歯医者",
    "今日のメモ #tech",
  ])("keeps %s verbatim and saves it as tweet/text", (text) => {
    expect(classify({ text })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "text",
      content: text,
    });
  });

  it("treats a URL behind a hashtag as text because the whole body is not a URL", () => {
    expect(classify({ text: "#tech https://example.com" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "text",
      content: "#tech https://example.com",
    });
  });

  it.each([
    ["#tweets", "#tweets"],
    ["#work 買う", "#work 買う"],
    ["#tweet", "#tweet"],
    ["#tweet   ", "#tweet"],
    ["#", "#"],
    ["＃todo", "＃todo"],
  ])(
    "saves %j, which used to be unknown_tag or empty_after_tag, as %j",
    (text, content) => {
      expect(classify({ text })).toEqual({
        save: true,
        tag: "tweet",
        mediaType: "text",
        content,
      });
    },
  );
});

describe("classify: surrounding whitespace", () => {
  it("trims a trailing newline and still detects the URL", () => {
    expect(classify({ text: "https://example.com\n" })).toEqual({
      save: true,
      tag: "tweet",
      mediaType: "url",
      content: "https://example.com",
    });
  });

  it("treats two URLs split by a newline as text", () => {
    expect(classify({ text: "https://a.com\nhttps://b.com" })).toMatchObject({
      save: true,
      mediaType: "text",
    });
  });
});

describe("classify: empty bodies", () => {
  it.each(["   ", "　　", "\n\n", " \t\n　"])(
    "rejects whitespace-only text %j",
    (text) => {
      expect(classify({ text })).toEqual({
        save: false,
        reason: "empty",
      });
    },
  );

  it("rejects missing text", () => {
    expect(classify({})).toEqual({ save: false, reason: "empty" });
  });
});

describe("replyTextFor", () => {
  it("maps each fail reason to the fixed LINE reply", () => {
    expect(replyTextFor("unsupported")).toBe(
      "この形式は保存できません。テキスト（URL含む）か画像を送信してください。",
    );
    expect(replyTextFor("empty")).toBe(
      "本文が空です。テキスト（URL含む）か画像を送ってください。",
    );
    expect(replyTextFor("save_failed")).toBe(
      "保存できませんでした。もう一度送ってください。",
    );
  });
});
