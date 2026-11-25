import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebMemoRecord } from "./dedup-record";
import type { NotionMemo } from "./notion-page";
import { createForUser, createFromLine, toMemoResponse } from "./service";

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

describe("toMemoResponse", () => {
  it("returns the memo without schedule keys for a tweet", () => {
    expect(
      toMemoResponse({
        ...memo,
        scheduledDate: "2026-11-03",
        scheduledTime: "14:00",
      }),
    ).toEqual({
      id: "memo_1",
      tag: "tweet",
      content: "秘密の本文",
      mediaType: "text",
      source: "web",
      createdAt: "2026-11-22T00:00:00.000Z",
    });
  });

  it("returns the date and time of a schedule", () => {
    expect(
      toMemoResponse({
        ...memo,
        tag: "schedule",
        scheduledDate: "2026-11-03",
        scheduledTime: "14:00",
      }),
    ).toMatchObject({ scheduledDate: "2026-11-03", scheduledTime: "14:00" });
  });

  it("omits the time key of an untimed schedule", () => {
    const response = toMemoResponse({
      ...memo,
      tag: "schedule",
      scheduledDate: "2026-11-03",
    });
    expect(response.scheduledDate).toBe("2026-11-03");
    expect("scheduledTime" in response).toBe(false);
  });
});

function fakeKv(values: Record<string, unknown>) {
  const put = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn(async (key: string) => values[key] ?? null);
  return { kv: { get, put } as unknown as KVNamespace, get, put };
}

function brokenKv() {
  const error = new Error("kv unavailable");
  return {
    get: vi.fn().mockRejectedValue(error),
    put: vi.fn().mockRejectedValue(error),
  } as unknown as KVNamespace;
}

const memoId = "8f2c1d4e-0b6a-4c3e-9d1f-2a7b5c8e9f01";

const recorded: WebMemoRecord = {
  id: memoId,
  userId: "user_1",
  tag: "tweet",
  content: "眠い",
  mediaType: "text",
  source: "web",
  createdAt: "2026-11-23T00:00:00.000Z",
  scheduledDate: null,
  scheduledTime: null,
};

describe("createForUser", () => {
  const input = { id: memoId, tag: "tweet" as const, content: "眠い" };

  it("returns the recorded memo for the same request without calling Notion", async () => {
    const { kv, put } = fakeKv({ [`web-memo:${memoId}`]: recorded });
    const notion = stubNotion({});
    silenceLog();

    const result = await createForUser(
      { ...notionEnv, DEDUP: kv },
      "user_1",
      input,
    );

    expect(result).toEqual({
      ok: true,
      created: false,
      memo: {
        id: memoId,
        tag: "tweet",
        content: "眠い",
        mediaType: "text",
        source: "web",
        createdAt: "2026-11-23T00:00:00.000Z",
      },
    });
    expect(notion.fetchMock).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("returns a conflict without the content when another user recorded the id", async () => {
    const { kv } = fakeKv({ [`web-memo:${memoId}`]: recorded });
    stubNotion({});
    const log = silenceLog();

    const result = await createForUser(
      { ...notionEnv, DEDUP: kv },
      "user_2",
      input,
    );

    expect(result).toEqual({ ok: false, error: "conflict" });
    expect(loggedLines(log).join("")).not.toContain("眠い");
  });

  it("saves a new memo to Notion and records it in KV with its owner", async () => {
    const { kv, put } = fakeKv({});
    const notion = stubNotion({ query: { found: 0 }, create: 200 });

    const result = await createForUser({ ...notionEnv, DEDUP: kv }, "user_1", {
      ...input,
      createdAt: "2026-11-23T09:00:00+09:00",
    });

    expect(result).toMatchObject({
      ok: true,
      created: true,
      memo: { id: memoId, createdAt: "2026-11-23T00:00:00.000Z" },
    });
    expect(notion.urls()).toEqual([QUERY_URL, PAGES_URL]);
    expect(put).toHaveBeenCalledWith(
      `web-memo:${memoId}`,
      JSON.stringify({
        id: memoId,
        tag: "tweet",
        content: "眠い",
        mediaType: "text",
        source: "web",
        createdAt: "2026-11-23T00:00:00.000Z",
        userId: "user_1",
        scheduledDate: null,
        scheduledTime: null,
      }),
      { expirationTtl: 2_592_000 },
    );
  });

  it("returns the memo as not created when Notion already has it but KV does not", async () => {
    const { kv, put } = fakeKv({});
    const notion = stubNotion({ query: { found: 1 } });
    silenceLog();

    const result = await createForUser(
      { ...notionEnv, DEDUP: kv },
      "user_1",
      input,
    );

    expect(result).toMatchObject({ ok: true, created: false });
    expect(notion.urls()).toEqual([QUERY_URL]);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("does not search Notion first when the request has no id", async () => {
    const { kv, get, put } = fakeKv({});
    const notion = stubNotion({ create: 200 });

    const result = await createForUser({ ...notionEnv, DEDUP: kv }, "user_1", {
      tag: "tweet",
      content: "眠い",
    });

    expect(result).toMatchObject({ ok: true, created: true });
    expect(notion.urls()).toEqual([PAGES_URL]);
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("fails without a KV record when Notion could not save", async () => {
    const { kv, put } = fakeKv({});
    stubNotion({ query: { found: 0 }, create: 400 });
    silenceLog();

    const result = await createForUser(
      { ...notionEnv, DEDUP: kv },
      "user_1",
      input,
    );

    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(put).not.toHaveBeenCalled();
  });

  it("logs a failed KV read without the content and searches Notion instead", async () => {
    const notion = stubNotion({ query: { found: 0 }, create: 200 });
    const log = silenceLog();

    const result = await createForUser(
      { ...notionEnv, DEDUP: brokenKv() },
      "user_1",
      input,
    );

    expect(result).toMatchObject({ ok: true, created: true });
    expect(notion.urls()).toEqual([QUERY_URL, PAGES_URL]);
    expect(loggedLines(log)).toEqual([
      JSON.stringify({
        event: "memo.dedup",
        status: "failed",
        reason: "read",
        memoId,
      }),
      JSON.stringify({
        event: "memo.dedup",
        status: "failed",
        reason: "write",
        memoId,
      }),
    ]);
  });

  it("rejects a past schedule date before reading KV or Notion", async () => {
    const { kv, get } = fakeKv({});
    const notion = stubNotion({});

    const result = await createForUser({ ...notionEnv, DEDUP: kv }, "user_1", {
      tag: "schedule",
      content: "歯医者",
      scheduledDate: "2000-01-01",
    });

    expect(result).toEqual({ ok: false, error: "past_date" });
    expect(get).not.toHaveBeenCalled();
    expect(notion.fetchMock).not.toHaveBeenCalled();
  });

  it("writes the schedule date and time to Notion and the record", async () => {
    const { kv, put } = fakeKv({});
    const notion = stubNotion({ query: { found: 0 }, create: 200 });

    const result = await createForUser({ ...notionEnv, DEDUP: kv }, "user_1", {
      id: memoId,
      tag: "schedule",
      content: "歯医者",
      scheduledDate: "2099-01-02",
      scheduledTime: "09:30",
    });

    expect(result).toMatchObject({
      ok: true,
      memo: { scheduledDate: "2099-01-02", scheduledTime: "09:30" },
    });
    const createCall = notion.fetchMock.mock.calls.find(
      (call) => call[0] === PAGES_URL,
    );
    expect(
      JSON.parse(String(createCall?.[1]?.body)).properties.予定日時,
    ).toEqual({
      date: { start: "2099-01-02T09:30:00", time_zone: "Asia/Tokyo" },
    });
    expect(JSON.parse(String(put.mock.calls[0]?.[1]))).toMatchObject({
      scheduledDate: "2099-01-02",
      scheduledTime: "09:30",
    });
  });
});

describe("createFromLine", () => {
  const input = {
    lineMessageId: "5000",
    classified: {
      save: true as const,
      tag: "tweet" as const,
      mediaType: "text" as const,
      content: "眠い",
    },
  };

  it("treats a recorded LINE message as a duplicate without calling Notion", async () => {
    const { kv, get, put } = fakeKv({ "line-message:5000": "{}" });
    const notion = stubNotion({});

    const result = await createFromLine({ ...notionEnv, DEDUP: kv }, input);

    expect(result).toEqual({ status: "duplicate" });
    expect(get).toHaveBeenCalledWith("line-message:5000");
    expect(put).not.toHaveBeenCalled();
    expect(notion.fetchMock).not.toHaveBeenCalled();
  });

  it("saves to Notion without searching first and records the message", async () => {
    const { kv, put } = fakeKv({});
    const notion = stubNotion({ create: 200 });

    const result = await createFromLine({ ...notionEnv, DEDUP: kv }, input);

    expect(result).toEqual({ status: "inserted" });
    expect(notion.urls()).toEqual([PAGES_URL]);
    const init = notion.fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body)).properties.入力元).toEqual({
      select: { name: "line" },
    });
    expect(put).toHaveBeenCalledWith("line-message:5000", expect.any(String), {
      expirationTtl: 604_800,
    });
  });

  it("fails without recording the message when Notion could not save", async () => {
    const { kv, put } = fakeKv({});
    stubNotion({ create: 400 });
    silenceLog();

    const result = await createFromLine({ ...notionEnv, DEDUP: kv }, input);

    expect(result).toEqual({ status: "failed", reason: "save_failed" });
    expect(put).not.toHaveBeenCalled();
  });

  it("logs a failed KV read without the message and still saves", async () => {
    stubNotion({ create: 200 });
    const log = silenceLog();

    const result = await createFromLine(
      { ...notionEnv, DEDUP: brokenKv() },
      input,
    );

    expect(result).toEqual({ status: "inserted" });
    expect(loggedLines(log)[0]).toBe(
      JSON.stringify({ event: "memo.dedup", status: "failed", reason: "read" }),
    );
    expect(loggedLines(log).join("")).not.toContain("眠い");
  });
});
