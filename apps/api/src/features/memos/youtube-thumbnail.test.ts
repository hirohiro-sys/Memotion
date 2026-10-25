import { describe, expect, it } from "vitest";
import { youtubeThumbnailCandidates } from "./youtube-thumbnail";

const ID = "dQw4w9WgXcQ";
const CANDIDATES = [
  `https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`,
  `https://i.ytimg.com/vi/${ID}/sddefault.jpg`,
  `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
];

describe("youtubeThumbnailCandidates", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=${ID}&t=43s&list=PLxxxx`,
    `https://youtube.com/watch?si=abc&v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://youtu.be/${ID}/`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/SHORTS/${ID}`,
    `https://YOUTU.BE/${ID}`,
    `https://www.youtube.com/embed/${ID}?start=10`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/v/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com./watch?v=${ID}`,
    `https://www.youtube.com/attribution_link?a=x&u=${encodeURIComponent(`/watch?v=${ID}&feature=share`)}`,
  ])("builds thumbnail urls for %s", (pageUrl) => {
    expect(youtubeThumbnailCandidates(pageUrl)).toEqual(CANDIDATES);
  });

  it.each([
    "not a url",
    `http://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=short`,
    `https://www.youtube.com/watch?v=${ID}x`,
    `https://youtu.be/dQw4w9WgX!Q`,
    "https://www.youtube.com/watch",
    "https://www.youtube.com/playlist?list=PLxxxx",
    "https://www.youtube.com/@RickAstley",
    "https://www.youtube.com/shorts/",
    "https://www.youtube.com/embed/videoseries?list=PLxxxx",
    "https://www.youtube.com/embed/VIDEOSERIES?list=PLxxxx",
    "https://www.youtube.com/embed/live_stream?channel=UCxxxx",
    "https://www.youtube-nocookie.com/embed/live_stream?channel=UCxxxx",
    `https://youtu.be.evil.com/${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://evil.example/watch?v=${ID}`,
    `https://evil.example/youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/attribution_link?a=x&u=${encodeURIComponent(`https://evil.example/watch?v=${ID}`)}`,
  ])("returns no candidates for %s", (pageUrl) => {
    expect(youtubeThumbnailCandidates(pageUrl)).toEqual([]);
  });
});
