import { describe, expect, it } from "vitest";
import { chunkMemoLinks, MEMO_LINK_CHUNK } from "./memo-links";

describe("chunkMemoLinks", () => {
  it("returns no statements for an empty list", () => {
    expect(chunkMemoLinks([])).toEqual([]);
  });

  it("keeps 33 rows in one statement and splits the 34th", () => {
    const rows = Array.from(
      { length: MEMO_LINK_CHUNK + 1 },
      (_, index) => index,
    );
    const chunks = chunkMemoLinks(rows);
    expect(chunks.map((chunk) => chunk.length)).toEqual([MEMO_LINK_CHUNK, 1]);
    expect(chunks[0]?.[0]).toBe(0);
    expect(chunks[1]?.[0]).toBe(MEMO_LINK_CHUNK);
  });

  it("fills each statement to 33 rows", () => {
    const rows = Array.from(
      { length: MEMO_LINK_CHUNK * 2 },
      (_, index) => index,
    );
    expect(chunkMemoLinks(rows).map((chunk) => chunk.length)).toEqual([
      MEMO_LINK_CHUNK,
      MEMO_LINK_CHUNK,
    ]);
  });
});
