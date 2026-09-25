export type OgpImage = { body: ArrayBuffer; contentType: string };

const FETCH_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; MemotionBot/1.0)",
};

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  if (host.includes(":")) {
    return (
      host === "::" ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80") ||
      host.startsWith("::ffff:")
    );
  }

  return false;
}

function isAllowedUrl(url: URL): boolean {
  return url.protocol === "https:" && !isBlockedHost(url.hostname);
}

async function discard(response: Response) {
  await response.body?.cancel();
}

async function fetchFollowingRedirects(
  start: URL,
  accept: string,
  signal: AbortSignal,
): Promise<{ response: Response; url: URL } | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isAllowedUrl(current)) return null;

    const response = await fetch(current.toString(), {
      redirect: "manual",
      signal,
      headers: { ...REQUEST_HEADERS, Accept: accept },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await discard(response);
      if (!location) return null;
      current = new URL(location, current);
      continue;
    }

    if (!response.ok) {
      await discard(response);
      return null;
    }
    return { response, url: current };
  }
  return null;
}

async function readLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; truncated: boolean }> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  if (body) {
    const reader = body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (total + value.byteLength > maxBytes) {
        chunks.push(value.subarray(0, maxBytes - total));
        total = maxBytes;
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

async function extractOgImages(html: Uint8Array<ArrayBuffer>) {
  const found: string[] = [];
  const collect = {
    element(element: Element) {
      const content = element.getAttribute("content")?.trim();
      if (content) found.push(content);
    },
  };
  await new HTMLRewriter()
    .on('meta[property="og:image"]', collect)
    .on('meta[name="og:image"]', collect)
    .transform(new Response(html))
    .arrayBuffer();
  return found;
}

async function fetchImage(
  candidate: string,
  base: URL,
  signal: AbortSignal,
): Promise<OgpImage | null> {
  let url: URL;
  try {
    url = new URL(candidate, base);
  } catch {
    return null;
  }

  const fetched = await fetchFollowingRedirects(url, "image/*", signal);
  if (!fetched) return null;
  const { response } = fetched;

  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (
    !contentType ||
    !IMAGE_TYPES.has(contentType) ||
    declaredLength > MAX_IMAGE_BYTES
  ) {
    await discard(response);
    return null;
  }

  const { bytes, truncated } = await readLimited(
    response.body,
    MAX_IMAGE_BYTES,
  );
  if (truncated || bytes.byteLength === 0) return null;
  return { body: bytes.buffer, contentType };
}

export async function fetchOgpImage(pageUrl: string): Promise<OgpImage | null> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    const page = await fetchFollowingRedirects(
      new URL(pageUrl),
      "text/html,application/xhtml+xml",
      signal,
    );
    if (!page) return null;

    const { bytes } = await readLimited(page.response.body, MAX_HTML_BYTES);
    for (const candidate of await extractOgImages(bytes)) {
      const image = await fetchImage(candidate, page.url, signal);
      if (image) return image;
    }
    return null;
  } catch {
    return null;
  }
}
