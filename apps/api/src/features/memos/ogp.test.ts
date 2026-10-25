import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOgpImage } from "./ogp";

const PAGE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const THUMBNAILS = [
  "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg",
  "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
];

afterEach(() => {
  vi.unstubAllGlobals();
});

function jpeg(bytes: number[]): Response {
  return new Response(Uint8Array.from(bytes), {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  });
}

describe("fetchOgpImage", () => {
  it("uses the first available YouTube thumbnail and skips the watch page", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/maxresdefault.jpg")) return jpeg([1, 2, 3]);
        return new Response(null, { status: 404 });
      }),
    );

    const image = await fetchOgpImage(PAGE);

    expect(image).toMatchObject({ contentType: "image/jpeg" });
    expect(image?.body.byteLength).toBe(3);
    expect(calls).toEqual([THUMBNAILS[0]]);
  });

  it("tries lower-quality thumbnails before the watch page", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/hqdefault.jpg")) return jpeg([9]);
        return new Response(null, { status: 404 });
      }),
    );

    const image = await fetchOgpImage(PAGE);

    expect(image?.contentType).toBe("image/jpeg");
    expect(calls).toEqual(THUMBNAILS);
  });

  it("tries the next thumbnail when an earlier request throws", async () => {
    const calls: string[] = [];
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(url);
        if (init?.signal) signals.push(init.signal);
        if (url.endsWith("/maxresdefault.jpg")) throw new Error("reset");
        if (url.endsWith("/hqdefault.jpg")) return jpeg([4]);
        return new Response(null, { status: 404 });
      }),
    );

    const image = await fetchOgpImage(PAGE);

    expect(image?.contentType).toBe("image/jpeg");
    expect(calls).toEqual(THUMBNAILS);
    expect(signals).toHaveLength(THUMBNAILS.length);
    expect(new Set(signals).size).toBe(THUMBNAILS.length);
    for (const signal of signals) expect(signal.aborted).toBe(false);
  });

  it("fetches the watch page when every thumbnail request throws", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.startsWith("https://i.ytimg.com/")) throw new Error("reset");
        return new Response(null, { status: 404 });
      }),
    );

    await expect(fetchOgpImage(PAGE)).resolves.toBeNull();
    expect(calls).toEqual([...THUMBNAILS, PAGE]);
  });

  it("requests the watch page when no YouTube thumbnail exists", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(null, { status: 404 });
      }),
    );

    await expect(fetchOgpImage(PAGE)).resolves.toBeNull();
    expect(calls).toEqual([...THUMBNAILS, PAGE]);
  });

  it("keeps fetching og:image for pages that are not a YouTube video", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(null, { status: 404 });
      }),
    );

    await expect(
      fetchOgpImage("https://www.youtube.com/@RickAstley"),
    ).resolves.toBeNull();
    await expect(fetchOgpImage("https://example.com/post")).resolves.toBeNull();
    expect(calls).toEqual([
      "https://www.youtube.com/@RickAstley",
      "https://example.com/post",
    ]);
  });
});
