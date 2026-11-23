import { describe, expect, it, vi } from "vitest";
import { toWebMemoRecord } from "./dedup-record";
import {
  findWebMemo,
  hasLineMessage,
  putLineMessage,
  putWebMemo,
} from "./dedup-repository";
import type { MemoRow } from "./repository";

// KV の get と put だけを持つ、メモリ上の偽物。
function memoryKv() {
  const store = new Map<string, string>();
  const put = vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  });
  const get = vi.fn(async (key: string, type?: "json") => {
    const value = store.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  });
  return { kv: { get, put } as unknown as KVNamespace, put };
}

const row: MemoRow = {
  id: "8f2c1d4e-0b6a-4c3e-9d1f-2a7b5c8e9f01",
  tag: "schedule",
  content: "歯医者",
  url: null,
  imageKey: null,
  mediaType: "text",
  source: "web",
  createdAt: "2026-11-23T00:00:00.000Z",
  groupId: "group_1",
  scheduledDate: "2026-11-24",
  scheduledTime: null,
};

describe("Web memo records", () => {
  it("reads back the written row with its owner", async () => {
    const { kv } = memoryKv();

    await putWebMemo(kv, toWebMemoRecord(row, "user_1"));

    expect(await findWebMemo(kv, row.id)).toEqual({ ...row, userId: "user_1" });
  });

  it("writes under the Web key and expires after 30 days", async () => {
    const { kv, put } = memoryKv();

    await putWebMemo(kv, toWebMemoRecord(row, "user_1"));

    expect(put).toHaveBeenCalledWith(`web-memo:${row.id}`, expect.any(String), {
      expirationTtl: 2_592_000,
    });
  });

  it("finds nothing for an id that was never written", async () => {
    const { kv } = memoryKv();

    expect(await findWebMemo(kv, row.id)).toBeNull();
  });
});

describe("LINE message records", () => {
  it("finds a written message and not another one", async () => {
    const { kv } = memoryKv();

    await putLineMessage(kv, "5000", "memo_1");

    expect(await hasLineMessage(kv, "5000")).toBe(true);
    expect(await hasLineMessage(kv, "5001")).toBe(false);
  });

  it("writes the memo id under the LINE key and expires after 7 days", async () => {
    const { kv, put } = memoryKv();

    await putLineMessage(kv, "5000", "memo_1");

    expect(put).toHaveBeenCalledWith(
      "line-message:5000",
      JSON.stringify({ memoId: "memo_1" }),
      { expirationTtl: 604_800 },
    );
  });
});
