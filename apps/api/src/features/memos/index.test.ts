import { createMemoRequestSchema } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { detectMediaType } from "./classify";
import { memoRoutes, toMemoResponse } from "./index";

const base = {
  id: "memo_1",
  tag: "tweet",
  content: "眠い",
  url: null,
  mediaType: "text",
  source: "line",
  createdAt: "2026-09-11T00:00:00.000Z",
};

describe("toMemoResponse", () => {
  it("omits a null url so the web schema can parse the list", () => {
    expect(toMemoResponse(base)).toEqual({
      id: "memo_1",
      tag: "tweet",
      content: "眠い",
      mediaType: "text",
      source: "line",
      createdAt: "2026-09-11T00:00:00.000Z",
    });
  });

  it("adds a relative image path and does not read thumbnailUrl from the DB", () => {
    expect(
      toMemoResponse({
        ...base,
        tag: "other",
        content: "（画像）",
        mediaType: "image",
      }),
    ).toEqual({
      id: "memo_1",
      tag: "other",
      content: "（画像）",
      mediaType: "image",
      source: "line",
      createdAt: "2026-09-11T00:00:00.000Z",
      thumbnailUrl: "/api/memos/memo_1/image",
    });
  });

  it("keeps a present url and does not add thumbnailUrl for url memos", () => {
    expect(
      toMemoResponse({
        ...base,
        tag: "tech",
        content: "https://example.com",
        url: "https://example.com",
        mediaType: "url",
      }),
    ).toEqual({
      id: "memo_1",
      tag: "tech",
      content: "https://example.com",
      url: "https://example.com",
      mediaType: "url",
      source: "line",
      createdAt: "2026-09-11T00:00:00.000Z",
    });
  });
});

describe("createMemoRequestSchema", () => {
  it("keeps tag and trimmed content and drops client-supplied fields", () => {
    expect(
      createMemoRequestSchema.parse({
        tag: "tweet",
        content: "  眠い  ",
        source: "line",
        mediaType: "image",
        url: "https://example.com",
        thumbnailUrl: "/api/memos/x/image",
      }),
    ).toEqual({ tag: "tweet", content: "眠い" });
  });

  it("rejects whitespace-only content", () => {
    expect(() =>
      createMemoRequestSchema.parse({ tag: "tech", content: "   " }),
    ).toThrow();
  });

  it("rejects an unknown tag", () => {
    expect(() =>
      createMemoRequestSchema.parse({ tag: "todo", content: "買う" }),
    ).toThrow();
  });
});

describe("detectMediaType", () => {
  it("treats a bare URL as url", () => {
    expect(detectMediaType("https://example.com/path?q=1")).toBe("url");
    expect(detectMediaType("http://example.com")).toBe("url");
  });

  it("treats prose, prose plus a URL, and whitespace-padded text as text", () => {
    expect(detectMediaType("眠い")).toBe("text");
    expect(detectMediaType("これ見て https://example.com")).toBe("text");
  });
});

describe("memo write routes without a session", () => {
  it("rejects create and delete with 401", async () => {
    const created = await memoRoutes.request("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: "tweet", content: "眠い" }),
    });
    expect(created.status).toBe(401);

    const deleted = await memoRoutes.request("/api/memos/memo_1", {
      method: "DELETE",
    });
    expect(deleted.status).toBe(401);
  });
});
