import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotionMemo } from "./notion-page";
import { saveMemoToNotion } from "./notion-repository";

const memo: NotionMemo = {
  id: "memo_1",
  tag: "tweet",
  content: "秘密の本文",
  mediaType: "text",
  source: "web",
  createdAt: "2026-11-22T00:00:00.000Z",
};

const notionEnv = {
  NOTION_TOKEN: "notion-secret",
  NOTION_DATA_SOURCE_ID: "ds_1",
};

const PAGES_URL = "https://api.notion.com/v1/pages";
const QUERY_URL = "https://api.notion.com/v1/data_sources/ds_1/query";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function loggedLines(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((call) => String(call[0]));
}

function silenceLog() {
  return vi.spyOn(console, "log").mockImplementation(() => {});
}

// Notion の偽物。ページの作成と検索に、決めた状態で答える。
// query は、検索で見つかるページの数か、失敗の HTTP の状態。
function stubNotion(options: {
  create?: number | "network";
  query?: { found: number } | { status: number };
}) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === PAGES_URL) {
      if (options.create === "network") throw new Error("network");
      return new Response("{}", { status: options.create ?? 200 });
    }
    if (url === QUERY_URL) {
      const query = options.query ?? { found: 0 };
      if ("status" in query)
        return new Response("{}", { status: query.status });
      return new Response(
        JSON.stringify({
          results: Array.from({ length: query.found }, () => ({})),
          has_more: false,
        }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    fetchMock,
    urls: () => fetchMock.mock.calls.map((call) => call[0]),
    queryBody: () => {
      const call = fetchMock.mock.calls.find((item) => item[0] === QUERY_URL);
      return JSON.parse(String(call?.[1]?.body));
    },
  };
}

describe("saveMemoToNotion", () => {
  it("creates a page under the configured data source", async () => {
    const notion = stubNotion({ create: 200 });
    const log = silenceLog();

    await expect(
      saveMemoToNotion(notionEnv, memo, { checkFirst: false }),
    ).resolves.toEqual({ ok: true, created: true });

    expect(notion.urls()).toEqual([PAGES_URL]);
    const init = notion.fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body)).parent).toEqual({
      type: "data_source_id",
      data_source_id: "ds_1",
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("searches by memo id first and does not create when the page exists", async () => {
    const notion = stubNotion({ query: { found: 1 } });
    const log = silenceLog();

    await expect(
      saveMemoToNotion(notionEnv, memo, { checkFirst: true }),
    ).resolves.toEqual({ ok: true, created: false });

    expect(notion.urls()).toEqual([QUERY_URL]);
    expect(notion.queryBody()).toEqual({
      filter: { property: "メモID", rich_text: { equals: "memo_1" } },
      page_size: 1,
    });
    expect(loggedLines(log)).toEqual([
      JSON.stringify({
        event: "memo.notion",
        status: "duplicate",
        memoId: "memo_1",
      }),
    ]);
  });

  it("creates after searching when no page has the memo id", async () => {
    const notion = stubNotion({ query: { found: 0 }, create: 200 });
    silenceLog();

    await expect(
      saveMemoToNotion(notionEnv, memo, { checkFirst: true }),
    ).resolves.toEqual({ ok: true, created: true });
    expect(notion.urls()).toEqual([QUERY_URL, PAGES_URL]);
  });

  it("still creates when the first search fails", async () => {
    const notion = stubNotion({ query: { status: 503 }, create: 200 });
    silenceLog();

    await expect(
      saveMemoToNotion(notionEnv, memo, { checkFirst: true }),
    ).resolves.toEqual({ ok: true, created: true });
    expect(notion.urls()).toEqual([QUERY_URL, PAGES_URL]);
  });

  it.each([503, 500, "network" as const])(
    "treats an ambiguous failure (%s) as saved when the page is found afterwards",
    async (create) => {
      const notion = stubNotion({ create, query: { found: 1 } });
      const log = silenceLog();

      await expect(
        saveMemoToNotion(notionEnv, memo, { checkFirst: false }),
      ).resolves.toEqual({ ok: true, created: true });
      expect(notion.urls()).toEqual([PAGES_URL, QUERY_URL]);
      expect(log).not.toHaveBeenCalled();
    },
  );

  it("fails and logs the HTTP status when an ambiguous failure left no page", async () => {
    stubNotion({ create: 503, query: { found: 0 } });
    const log = silenceLog();

    await expect(
      saveMemoToNotion(notionEnv, memo, { checkFirst: false }),
    ).resolves.toEqual({ ok: false });
    expect(loggedLines(log)).toEqual([
      JSON.stringify({
        event: "memo.notion",
        status: "failed",
        httpStatus: 503,
        memoId: "memo_1",
      }),
    ]);
    expect(loggedLines(log).join("")).not.toContain("秘密の本文");
    expect(loggedLines(log).join("")).not.toContain("notion-secret");
  });

  it("logs 0 for a network failure when the check also fails", async () => {
    stubNotion({ create: "network", query: { status: 503 } });
    const log = silenceLog();

    await expect(
      saveMemoToNotion(notionEnv, memo, { checkFirst: false }),
    ).resolves.toEqual({ ok: false });
    expect(JSON.parse(loggedLines(log)[0] ?? "{}").httpStatus).toBe(0);
  });

  it.each([400, 401, 404, 429])(
    "fails on %s without searching, since the page was not written",
    async (create) => {
      const notion = stubNotion({ create });
      const log = silenceLog();

      await expect(
        saveMemoToNotion(notionEnv, memo, { checkFirst: false }),
      ).resolves.toEqual({ ok: false });
      expect(notion.urls()).toEqual([PAGES_URL]);
      expect(JSON.parse(loggedLines(log)[0] ?? "{}").httpStatus).toBe(create);
    },
  );

  it("fails and logs without calling Notion when the secrets are missing", async () => {
    const notion = stubNotion({});
    const log = silenceLog();

    await expect(
      saveMemoToNotion({ NOTION_TOKEN: "notion-secret" }, memo, {
        checkFirst: true,
      }),
    ).resolves.toEqual({ ok: false });
    expect(notion.fetchMock).not.toHaveBeenCalled();
    expect(loggedLines(log)).toEqual([
      JSON.stringify({
        event: "memo.notion",
        status: "skipped",
        reason: "no_secret",
        memoId: "memo_1",
      }),
    ]);
  });
});
