import { describe, expect, it, vi } from "vitest";
import { checkUserExists, fetchAttendedEvents } from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function item(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `イベント${id}`,
    started_at: "2026-11-03T19:00:00+09:00",
    open_status: "open",
    ...overrides,
  };
}

const INPUT = {
  apiKey: "key-123",
  nickname: "taro",
  months: ["202610", "202611"],
};

describe("fetchAttendedEvents", () => {
  it("calls the events API with the key, nickname, months and paging", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ results_available: 1, events: [item(1)] }),
    );
    const result = await fetchAttendedEvents(INPUT, {
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => undefined,
    });

    expect(result).toEqual({
      status: "ok",
      events: [
        {
          id: 1,
          title: "イベント1",
          startedAt: "2026-11-03T19:00:00+09:00",
          openStatus: "open",
        },
      ],
      complete: true,
      pages: 1,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://connpass.com/api/v2/events/",
    );
    expect(parsed.searchParams.get("nickname")).toBe("taro");
    expect(parsed.searchParams.getAll("ym")).toEqual(["202610", "202611"]);
    expect(parsed.searchParams.get("count")).toBe("100");
    expect(parsed.searchParams.get("start")).toBe("1");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe(
      "key-123",
    );
    expect(init.redirect).toBe("manual");
    // User-Agent が無いと connpass は 403 を返す。
    expect((init.headers as Record<string, string>)["User-Agent"]).toBeTruthy();
  });

  it("keeps a nickname with special characters inside its query value", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ results_available: 0, events: [] }),
    );
    await fetchAttendedEvents(
      { ...INPUT, nickname: "a&b=c" },
      {
        fetch: fetchMock as unknown as typeof fetch,
        sleep: async () => undefined,
      },
    );
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("nickname")).toBe("a&b=c");
    expect(parsed.searchParams.has("b")).toBe(false);
  });

  it("reads every page and waits between requests", async () => {
    const sleep = vi.fn(async () => undefined);
    const starts: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const start = new URL(url).searchParams.get("start") ?? "";
      starts.push(start);
      const first = start === "1";
      return jsonResponse({
        results_available: 150,
        events: first
          ? Array.from({ length: 100 }, (_, i) => item(i + 1))
          : Array.from({ length: 50 }, (_, i) => item(i + 101)),
      });
    });
    const result = await fetchAttendedEvents(INPUT, {
      fetch: fetchMock as unknown as typeof fetch,
      sleep,
    });

    expect(starts).toEqual(["1", "101"]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(result).toMatchObject({ status: "ok", complete: true, pages: 2 });
    expect(result.status === "ok" && result.events).toHaveLength(150);
  });

  it("treats a result that stops at the page limit as incomplete", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results_available: 5000,
        events: Array.from({ length: 100 }, (_, i) => item(i + 1)),
      }),
    );
    const result = await fetchAttendedEvents(INPUT, {
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(result).toMatchObject({ status: "ok", complete: false, pages: 10 });
  });

  it("is incomplete when a page is empty but more are announced", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ results_available: 50, events: [] }),
    );
    const result = await fetchAttendedEvents(INPUT, {
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(result).toMatchObject({ status: "ok", complete: false });
  });

  it("is incomplete when a later page is empty while more are announced", async () => {
    let call = 0;
    const result = await fetchAttendedEvents(INPUT, {
      fetch: (async () => {
        call += 1;
        return jsonResponse({
          results_available: 250,
          events:
            call === 1
              ? Array.from({ length: 100 }, (_, i) => item(i + 1))
              : [],
        });
      }) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(result).toMatchObject({ status: "ok", complete: false, pages: 2 });
  });

  it("asks for the next page from the number of events already read", async () => {
    const starts: string[] = [];
    await fetchAttendedEvents(INPUT, {
      fetch: (async (url: string) => {
        const start = new URL(url).searchParams.get("start") ?? "";
        starts.push(start);
        return jsonResponse({
          results_available: 150,
          events:
            start === "1"
              ? Array.from({ length: 60 }, (_, i) => item(i + 1))
              : Array.from({ length: 90 }, (_, i) => item(i + 61)),
        });
      }) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(starts).toEqual(["1", "61"]);
  });

  it("is complete when exactly 1000 events are read over 10 pages", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const start = Number(new URL(url).searchParams.get("start"));
      return jsonResponse({
        results_available: 1000,
        events: Array.from({ length: 100 }, (_, i) => item(start + i)),
      });
    });
    const result = await fetchAttendedEvents(INPUT, {
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(result).toMatchObject({ status: "ok", complete: true, pages: 10 });
  });

  it("stops as incomplete when the time budget runs out between pages", async () => {
    let clock = 0;
    const fetchMock = vi.fn(async () => {
      clock += 30_000;
      return jsonResponse({
        results_available: 500,
        events: Array.from({ length: 100 }, (_, i) => item(i + 1)),
      });
    });
    const result = await fetchAttendedEvents(INPUT, {
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => undefined,
      now: () => clock,
    });
    // 1 ページ目で 30 秒、2 ページ目で 60 秒。45 秒を超えた時点で次のページへ進まない。
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "ok", complete: false, pages: 2 });
  });

  it("does not call connpass with an empty API key", async () => {
    const fetchMock = vi.fn();
    const events = await fetchAttendedEvents(
      { ...INPUT, apiKey: "  " },
      { fetch: fetchMock as unknown as typeof fetch },
    );
    const user = await checkUserExists(
      { apiKey: "", nickname: "taro" },
      { fetch: fetchMock as unknown as typeof fetch },
    );
    expect(events).toEqual({ status: "failed" });
    expect(user).toEqual({ status: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails on a start time without a time zone or one that cannot be read", async () => {
    for (const startedAt of ["2026-11-03T19:00:00", "2026-11-03", "garbage"]) {
      const result = await fetchAttendedEvents(INPUT, {
        fetch: (async () =>
          jsonResponse({
            results_available: 1,
            events: [item(1, { started_at: startedAt })],
          })) as unknown as typeof fetch,
        sleep: async () => undefined,
      });
      expect(result.status).toBe("failed");
    }
  });

  it("fails on a page with more events than the page size", async () => {
    const result = await fetchAttendedEvents(INPUT, {
      fetch: (async () =>
        jsonResponse({
          results_available: 101,
          events: Array.from({ length: 101 }, (_, i) => item(i + 1)),
        })) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(result.status).toBe("failed");
  });

  it("is complete with no events at all", async () => {
    const result = await fetchAttendedEvents(INPUT, {
      fetch: (async () =>
        jsonResponse({
          results_available: 0,
          events: [],
        })) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(result).toMatchObject({ status: "ok", complete: true, events: [] });
  });

  it("accepts an event without a start time", async () => {
    const result = await fetchAttendedEvents(INPUT, {
      fetch: (async () =>
        jsonResponse({
          results_available: 1,
          events: [item(1, { started_at: null })],
        })) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(result.status === "ok" && result.events[0]?.startedAt).toBeNull();
  });

  it.each([401, 429, 500])("fails on HTTP %i", async (status) => {
    const result = await fetchAttendedEvents(INPUT, {
      fetch: (async () =>
        jsonResponse({ message: "x" }, status)) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(result).toEqual({ status: "failed", httpStatus: status });
  });

  it("fails as a whole when the second page fails", async () => {
    let call = 0;
    const result = await fetchAttendedEvents(INPUT, {
      fetch: (async () => {
        call += 1;
        if (call === 1) {
          return jsonResponse({
            results_available: 150,
            events: Array.from({ length: 100 }, (_, i) => item(i + 1)),
          });
        }
        return jsonResponse({}, 429);
      }) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(result).toEqual({ status: "failed", httpStatus: 429 });
  });

  it("fails on a network error or timeout", async () => {
    const result = await fetchAttendedEvents(INPUT, {
      fetch: (async () => {
        throw new Error("network");
      }) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(result).toEqual({ status: "failed", httpStatus: undefined });
  });

  it("fails on a response with a different shape", async () => {
    const bad = [
      { results_available: 1, events: [item(1, { id: "1" })] },
      { results_available: 1, events: [item(1, { open_status: "weird" })] },
      { events: [] },
    ];
    for (const body of bad) {
      const result = await fetchAttendedEvents(INPUT, {
        fetch: (async () => jsonResponse(body)) as unknown as typeof fetch,
        sleep: async () => undefined,
      });
      expect(result.status).toBe("failed");
    }
  });
});

describe("checkUserExists", () => {
  const input = { apiKey: "key-123", nickname: "taro" };

  it("is true when the same nickname comes back (case-insensitive)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ users: [{ nickname: "Taro" }] }),
    );
    const result = await checkUserExists(input, {
      fetch: fetchMock as unknown as typeof fetch,
    });
    // connpass の表記（Taro）を返す。
    expect(result).toEqual({ status: "ok", exists: true, nickname: "Taro" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://connpass.com/api/v2/users/?nickname=taro");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe(
      "key-123",
    );
  });

  it("is false for no users or for another nickname", async () => {
    for (const users of [[], [{ nickname: "taro2" }]]) {
      const result = await checkUserExists(input, {
        fetch: (async () => jsonResponse({ users })) as unknown as typeof fetch,
      });
      expect(result).toEqual({ status: "ok", exists: false });
    }
  });

  it("fails when connpass is unavailable", async () => {
    const result = await checkUserExists(input, {
      fetch: (async () => jsonResponse({}, 500)) as unknown as typeof fetch,
    });
    expect(result).toEqual({ status: "failed", httpStatus: 500 });
  });
});
