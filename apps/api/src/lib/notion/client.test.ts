import { afterEach, describe, expect, it, vi } from "vitest";
import { createPage, NOTION_VERSION, queryDataSource } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createPage", () => {
  it("posts the body to the Notion pages endpoint with the version header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = { parent: { data_source_id: "ds_1" } };

    await expect(createPage({ token: "secret", body })).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
        "Notion-Version": "2025-09-03",
      },
      body: JSON.stringify(body),
    });
    expect(NOTION_VERSION).toBe("2025-09-03");
  });

  it("returns the HTTP status when Notion rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 404 })),
    );

    await expect(createPage({ token: "secret", body: {} })).resolves.toEqual({
      ok: false,
      status: 404,
    });
  });

  it("returns status 0 when the network call throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(createPage({ token: "secret", body: {} })).resolves.toEqual({
      ok: false,
      status: 0,
    });
  });
});

describe("queryDataSource", () => {
  const input = {
    token: "secret",
    dataSourceId: "ds_1",
    body: { page_size: 100 },
  };

  it("posts the filter to the data source query endpoint and returns the pages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: [{ id: "p1" }],
        has_more: true,
        next_cursor: "c2",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(queryDataSource(input)).resolves.toEqual({
      ok: true,
      results: [{ id: "p1" }],
      nextCursor: "c2",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.notion.com/v1/data_sources/ds_1/query",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
          "Notion-Version": "2025-09-03",
        },
        body: JSON.stringify({ page_size: 100 }),
      },
    );
  });

  it("returns no cursor on the last page", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ results: [], has_more: false, next_cursor: null }),
        ),
    );
    await expect(queryDataSource(input)).resolves.toEqual({
      ok: true,
      results: [],
      nextCursor: null,
    });
  });

  it("returns the HTTP status on an error and on an unreadable body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 429 })),
    );
    await expect(queryDataSource(input)).resolves.toEqual({
      ok: false,
      status: 429,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    await expect(queryDataSource(input)).resolves.toEqual({
      ok: false,
      status: 200,
    });
  });

  it("returns 0 when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(queryDataSource(input)).resolves.toEqual({
      ok: false,
      status: 0,
    });
  });
});
