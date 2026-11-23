import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExistingMemoRow } from "./idempotency";
import type { NotionMemo } from "./notion-page";
import { createForUser, createFromLine, syncMemoToNotion } from "./service";

const memo: NotionMemo = {
  id: "memo_1",
  tag: "tweet",
  content: "秘密の本文",
  mediaType: "text",
  source: "web",
  createdAt: "2026-11-22T00:00:00.000Z",
};

const env = { NOTION_TOKEN: "notion-secret", NOTION_DATA_SOURCE_ID: "ds_1" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function loggedLines(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((call) => String(call[0]));
}

describe("syncMemoToNotion", () => {
  it("creates a Notion page under the configured data source", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await syncMemoToNotion(env, memo);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.notion.com/v1/pages");
    expect(JSON.parse(String(init?.body)).parent).toEqual({
      type: "data_source_id",
      data_source_id: "ds_1",
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("logs the failure with the HTTP status but without the body or token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(syncMemoToNotion(env, memo)).resolves.toBeUndefined();

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

  it("skips and logs when the Notion secrets are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await syncMemoToNotion({ NOTION_TOKEN: "notion-secret" }, memo);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggedLines(log)).toEqual([
      JSON.stringify({
        event: "memo.notion",
        status: "skipped",
        reason: "no_secret",
        memoId: "memo_1",
      }),
    ]);
  });

  it("does not write an image memo to Notion", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await syncMemoToNotion(env, {
      ...memo,
      mediaType: "image",
      content: "（画像）",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});

// KV の記録が当たる経路は D1 に触らない。触ったら落ちるよう、DB は渡さない。
const noDb = undefined as never;

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

const recorded: ExistingMemoRow = {
  id: memoId,
  userId: "user_1",
  tag: "tweet",
  content: "眠い",
  url: null,
  imageKey: null,
  mediaType: "text",
  source: "web",
  createdAt: "2026-11-23T00:00:00.000Z",
  groupId: null,
  scheduledDate: null,
  scheduledTime: null,
};

describe("createForUser with a KV record", () => {
  it("returns the recorded memo for the same request without saving again", async () => {
    const { kv, get } = fakeKv({ [`web-memo:${memoId}`]: recorded });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await createForUser(noDb, kv, "user_1", {
      id: memoId,
      tag: "tweet",
      content: "眠い",
    });

    expect(get).toHaveBeenCalledWith(`web-memo:${memoId}`, "json");
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
    expect(loggedLines(log)).toEqual([
      JSON.stringify({ event: "memo.create", status: "duplicate", memoId }),
    ]);
  });

  it("returns a conflict when the content differs", async () => {
    const { kv } = fakeKv({ [`web-memo:${memoId}`]: recorded });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await createForUser(noDb, kv, "user_1", {
      id: memoId,
      tag: "tweet",
      content: "眠くない",
    });

    expect(result).toEqual({ ok: false, error: "conflict" });
    expect(loggedLines(log)).toEqual([
      JSON.stringify({ event: "memo.create", status: "conflict", memoId }),
    ]);
  });

  it("returns a conflict without the content when another user recorded the id", async () => {
    const { kv } = fakeKv({ [`web-memo:${memoId}`]: recorded });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await createForUser(noDb, kv, "user_2", {
      id: memoId,
      tag: "tweet",
      content: "眠い",
    });

    expect(result).toEqual({ ok: false, error: "conflict" });
    expect(loggedLines(log).join("")).not.toContain("眠い");
  });

  it("logs a failed KV read without the content and falls back to D1", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // D1 を渡していないので、D1 の判定に進んだところで落ちる。
    await expect(
      createForUser(noDb, brokenKv(), "user_1", {
        id: memoId,
        tag: "tweet",
        content: "眠い",
      }),
    ).rejects.toThrow();

    expect(loggedLines(log)).toEqual([
      JSON.stringify({
        event: "memo.dedup",
        status: "failed",
        reason: "read",
        memoId,
      }),
    ]);
  });

  it("does not read KV when the request has no id", async () => {
    const { kv, get } = fakeKv({});

    await expect(
      createForUser(noDb, kv, "user_1", { tag: "tweet", content: "眠い" }),
    ).rejects.toThrow();

    expect(get).not.toHaveBeenCalled();
  });
});

describe("createFromLine with a KV record", () => {
  const lineEnv = {
    DB: noDb,
    MEDIA: noDb,
    LINE_CHANNEL_ACCESS_TOKEN: "line-secret",
  };
  const input = {
    userId: "user_1",
    lineMessageId: "5000",
    classified: {
      save: true as const,
      tag: "tweet" as const,
      mediaType: "text" as const,
      content: "眠い",
    },
  };

  it("treats a recorded LINE message as a duplicate without saving again", async () => {
    const { kv, get, put } = fakeKv({ "line-message:5000": "{}" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createFromLine({ ...lineEnv, DEDUP: kv }, input);

    expect(result).toEqual({ status: "duplicate" });
    expect(get).toHaveBeenCalledWith("line-message:5000");
    expect(put).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs a failed KV read without the message and falls back to D1", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // D1 を渡していないので、D1 の判定に進むと保存の失敗になる。
    const result = await createFromLine(
      { ...lineEnv, DEDUP: brokenKv() },
      input,
    );

    expect(result).toEqual({ status: "failed", reason: "save_failed" });
    expect(loggedLines(log)).toEqual([
      JSON.stringify({ event: "memo.dedup", status: "failed", reason: "read" }),
    ]);
    expect(loggedLines(log).join("")).not.toContain("眠い");
  });
});
