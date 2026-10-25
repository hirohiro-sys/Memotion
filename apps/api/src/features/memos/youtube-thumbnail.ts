const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PATH_ID_PREFIXES = new Set(["embed", "shorts", "live", "v", "e"]);
// 再生リストとチャンネルライブの埋め込み名。11文字だが動画 ID ではない。
const RESERVED_VIDEO_IDS = new Set(["videoseries", "live_stream"]);
const THUMBNAIL_QUALITIES = [
  "maxresdefault",
  "sddefault",
  "hqdefault",
] as const;

// watch ページの og:image は HTML の奥にあり、1MB の読み取りで欠ける。
// 動画 ID が分かる URL は i.ytimg.com の静止画を候補にする。
export function youtubeThumbnailCandidates(pageUrl: string): string[] {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return [];
  }

  const id = videoIdFromUrl(url);
  if (!id) return [];
  return THUMBNAIL_QUALITIES.map(
    (quality) => `https://i.ytimg.com/vi/${id}/${quality}.jpg`,
  );
}

function videoIdFromUrl(url: URL, allowEmbedded = true): string | null {
  if (url.protocol !== "https:" || !isYoutubeHostname(url.hostname)) {
    return null;
  }

  const host = normalizedHost(url.hostname);
  const parts = url.pathname.split("/").filter(Boolean);
  const head = parts[0]?.toLowerCase();

  if (host === "youtu.be") return videoId(parts[0]);
  if (head === "watch") return videoId(url.searchParams.get("v"));
  if (head && PATH_ID_PREFIXES.has(head)) return videoId(parts[1]);
  if (head === "attribution_link" && allowEmbedded) {
    const embedded = url.searchParams.get("u");
    if (!embedded) return null;
    try {
      return videoIdFromUrl(new URL(embedded, url), false);
    } catch {
      return null;
    }
  }
  return null;
}

function videoId(value: string | null | undefined): string | null {
  if (!value || !VIDEO_ID.test(value)) return null;
  if (RESERVED_VIDEO_IDS.has(value.toLowerCase())) return null;
  return value;
}

function isYoutubeHostname(hostname: string): boolean {
  const host = normalizedHost(hostname);
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  );
}

function normalizedHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, "");
}
