import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotionMemo } from "./notion-page";
import { syncMemoToNotion } from "./service";

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
