import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../env";
import {
  runScheduleDailyDigest,
  runTechWeeklyDigest,
  runTodoDailyDigest,
} from "./scheduled";

const NOTION_QUERY = "https://api.notion.com/v1/data_sources/ds_1/query";
const LINE_PUSH = "https://api.line.me/v2/bot/message/push";

function memoryKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const kv = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  return { kv: kv as unknown as KVNamespace, store, raw: kv };
}

function makeEnv(kv: KVNamespace, overrides: Partial<Env> = {}): Env {
  return {
    DEDUP: kv,
    LINE_CHANNEL_ACCESS_TOKEN: "line-secret",
    APP_URL: "https://memo.example",
    NOTION_TOKEN: "notion-secret",
    NOTION_DATA_SOURCE_ID: "ds_1",
    NOTIFY_LINE_USER_ID: "U_owner",
    TECH_WEEKLY: "sun 20:00",
    TODO_DAILY: "08:00",
    SCHEDULE_DAILY: "20:00",
    ...overrides,
  } as Env;
}

function notionPage(content: string, scheduledAt?: string) {
  return {
    object: "page",
    properties: {
      本文: { title: [{ type: "text", plain_text: content }] },
      記録日時: {
        date: { start: "2026-11-20T09:00:00.000+09:00", time_zone: null },
      },
      ...(scheduledAt
        ? { 予定日時: { date: { start: scheduledAt, time_zone: null } } }
        : {}),
    },
  };
}

// URL ごとに応答を返す fetch。呼ばれた URL と body を記録する。
function routeFetch(routes: { notion?: Response; line?: Response }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === NOTION_QUERY && routes.notion) return routes.notion.clone();
    if (url === LINE_PUSH && routes.line) return routes.line.clone();
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function calledUrls(fetchMock: ReturnType<typeof routeFetch>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function logs(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((call) => String(call[0]));
}

// JST の時刻を UTC の Date にする。
function jst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

const TODO_KEY = "notify:todo-daily:last-sent-at";
const TECH_KEY = "notify:tech-weekly:last-sent-at";
const SCHEDULE_KEY = "notify:schedule-daily:last-target-date";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runTodoDailyDigest", () => {
  const now = jst("2026-11-23T08:00:00");
  const yesterday = jst("2026-11-22T08:00:00").toISOString();

  it("records a baseline on the first run without reading Notion or sending", async () => {
    const { kv, store } = memoryKv();
    const fetchMock = routeFetch({});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(makeEnv(kv), now);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get(TODO_KEY)).toBe(now.toISOString());
    expect(logs(log)).toEqual([
      JSON.stringify({
        event: "todo.daily",
        action: "skipped",
        reason: "baseline",
      }),
    ]);
  });

  it("sends the todos from Notion to the configured user and records the send", async () => {
    const { kv, store } = memoryKv({ [TODO_KEY]: yesterday });
    const fetchMock = routeFetch({
      notion: Response.json({ results: [notionPage("牛乳を買う")] }),
      line: new Response("{}", { status: 200 }),
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(makeEnv(kv), now);

    expect(calledUrls(fetchMock)).toEqual([NOTION_QUERY, LINE_PUSH]);
    const push = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(push.to).toBe("U_owner");
    expect(push.messages[0].text).toContain("未完了のTODO 1件");
    expect(push.messages[0].text).toContain("牛乳を買う");
    expect(store.get(TODO_KEY)).toBe(now.toISOString());
    expect(logs(log)).toEqual([
      JSON.stringify({
        event: "todo.daily",
        action: "success",
        count: 1,
        messages: 1,
      }),
    ]);
  });

  it("does nothing before the time", async () => {
    const { kv, store } = memoryKv({ [TODO_KEY]: yesterday });
    const fetchMock = routeFetch({});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(makeEnv(kv), jst("2026-11-23T07:59:00"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get(TODO_KEY)).toBe(yesterday);
    expect(log).not.toHaveBeenCalled();
  });

  it("keeps the record and retries next minute when Notion fails", async () => {
    const { kv, store } = memoryKv({ [TODO_KEY]: yesterday });
    const fetchMock = routeFetch({
      notion: new Response("{}", { status: 503 }),
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(makeEnv(kv), now);

    expect(calledUrls(fetchMock)).toEqual([NOTION_QUERY]);
    expect(store.get(TODO_KEY)).toBe(yesterday);
    expect(logs(log)).toEqual([
      JSON.stringify({
        event: "todo.daily",
        action: "failed",
        reason: "upstream",
        httpStatus: 503,
      }),
    ]);
  });

  it("records an empty run without sending", async () => {
    const { kv, store } = memoryKv({ [TODO_KEY]: yesterday });
    const fetchMock = routeFetch({ notion: Response.json({ results: [] }) });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(makeEnv(kv), now);

    expect(calledUrls(fetchMock)).toEqual([NOTION_QUERY]);
    expect(store.get(TODO_KEY)).toBe(now.toISOString());
  });

  it("records the run without reading Notion when no recipient is set", async () => {
    const { kv, store } = memoryKv({ [TODO_KEY]: yesterday });
    const fetchMock = routeFetch({});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(
      makeEnv(kv, { NOTIFY_LINE_USER_ID: undefined }),
      now,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get(TODO_KEY)).toBe(now.toISOString());
    expect(logs(log)).toEqual([
      JSON.stringify({
        event: "todo.daily",
        action: "skipped",
        reason: "no_recipient",
      }),
    ]);
  });

  it("does not record a transient LINE failure so it retries", async () => {
    const { kv, store } = memoryKv({ [TODO_KEY]: yesterday });
    routeFetch({
      notion: Response.json({ results: [notionPage("牛乳を買う")] }),
      line: new Response("{}", { status: 500 }),
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(makeEnv(kv), now);

    expect(store.get(TODO_KEY)).toBe(yesterday);
  });

  it("logs an invalid setting without reading KV", async () => {
    const { kv, raw } = memoryKv();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(makeEnv(kv, { TODO_DAILY: "8時" }), now);

    expect(raw.get).not.toHaveBeenCalled();
    expect(logs(log)).toEqual([
      JSON.stringify({
        event: "todo.daily",
        action: "skipped",
        reason: "invalid",
      }),
    ]);
  });

  it("never logs the memo body or the secrets", async () => {
    const { kv } = memoryKv({ [TODO_KEY]: yesterday });
    routeFetch({
      notion: Response.json({ results: [notionPage("秘密のTODO")] }),
      line: new Response("{}", { status: 500 }),
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runTodoDailyDigest(makeEnv(kv), now);

    const joined = logs(log).join("");
    expect(joined).not.toContain("秘密のTODO");
    expect(joined).not.toContain("notion-secret");
    expect(joined).not.toContain("U_owner");
  });
});

describe("runTechWeeklyDigest", () => {
  it("does nothing when the setting is off", async () => {
    const { kv, raw } = memoryKv();
    const fetchMock = routeFetch({});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runTechWeeklyDigest(
      makeEnv(kv, { TECH_WEEKLY: "" }),
      jst("2026-11-22T20:00:00"),
    );

    expect(raw.get).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("sends only the tech memos recorded inside the week", async () => {
    const { kv } = memoryKv({
      [TECH_KEY]: jst("2026-11-15T20:00:00").toISOString(),
    });
    const outside = {
      ...notionPage("先週の記事"),
      properties: {
        ...notionPage("先週の記事").properties,
        記録日時: {
          date: { start: "2026-11-15T19:00:00.000+09:00", time_zone: null },
        },
      },
    };
    const fetchMock = routeFetch({
      notion: Response.json({ results: [notionPage("今週の記事"), outside] }),
      line: new Response("{}", { status: 200 }),
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runTechWeeklyDigest(makeEnv(kv), jst("2026-11-22T20:00:00"));

    const text = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
      .messages[0].text;
    expect(text).toContain("今週のTech 1件");
    expect(text).toContain("今週の記事");
    expect(text).not.toContain("先週の記事");
  });
});

describe("runScheduleDailyDigest", () => {
  const now = jst("2026-11-23T20:00:00");

  it("sends tomorrow's schedules and keeps the claimed date", async () => {
    const { kv, store } = memoryKv({ [SCHEDULE_KEY]: "2026-11-23" });
    const fetchMock = routeFetch({
      notion: Response.json({
        results: [
          notionPage("歯医者", "2026-11-24T09:30:00.000+09:00"),
          notionPage("明後日", "2026-11-25"),
        ],
      }),
      line: new Response("{}", { status: 200 }),
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runScheduleDailyDigest(makeEnv(kv), now);

    const text = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
      .messages[0].text;
    expect(text).toContain("明日の予定 1件（11/24）");
    expect(text).toContain("09:30 歯医者");
    expect(store.get(SCHEDULE_KEY)).toBe("2026-11-24");
  });

  it("restores the previous date after a transient LINE failure", async () => {
    const { kv, store } = memoryKv({ [SCHEDULE_KEY]: "2026-11-23" });
    routeFetch({
      notion: Response.json({
        results: [notionPage("歯医者", "2026-11-24")],
      }),
      line: new Response("{}", { status: 500 }),
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runScheduleDailyDigest(makeEnv(kv), now);

    expect(store.get(SCHEDULE_KEY)).toBe("2026-11-23");
  });

  it("restores the previous date when Notion fails", async () => {
    const { kv, store } = memoryKv({ [SCHEDULE_KEY]: "2026-11-23" });
    routeFetch({ notion: new Response("{}", { status: 502 }) });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runScheduleDailyDigest(makeEnv(kv), now);

    expect(store.get(SCHEDULE_KEY)).toBe("2026-11-23");
  });

  it("keeps the claimed date when LINE is unreachable", async () => {
    const { kv, store } = memoryKv({ [SCHEDULE_KEY]: "2026-11-23" });
    routeFetch({
      notion: Response.json({
        results: [notionPage("歯医者", "2026-11-24")],
      }),
      line: new Response(
        JSON.stringify({
          message: "The user is not a friend of the LINE Official Account.",
        }),
        { status: 400 },
      ),
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runScheduleDailyDigest(makeEnv(kv), now);

    expect(store.get(SCHEDULE_KEY)).toBe("2026-11-24");
  });

  it("marks the current target as done on the first run without sending", async () => {
    const { kv, store } = memoryKv();
    const fetchMock = routeFetch({});
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runScheduleDailyDigest(makeEnv(kv), now);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get(SCHEDULE_KEY)).toBe("2026-11-24");
  });
});
