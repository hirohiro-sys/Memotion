import { afterEach, describe, expect, it, vi } from "vitest";
import { createPage, NOTION_VERSION } from "./client";

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
