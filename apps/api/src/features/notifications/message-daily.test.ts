import { describe, expect, it } from "vitest";
import {
  buildTodoDigestMessages,
  DIGEST_TEXT_LIMIT,
  type DigestMemo,
} from "./message";

const APP_URL = "https://memo.example";

function memo(
  input: Partial<DigestMemo> & Pick<DigestMemo, "content">,
): DigestMemo {
  return {
    createdAt: "2026-09-08T00:00:00.000Z",
    mediaType: "text",
    url: null,
    ...input,
  };
}

describe("buildTodoDigestMessages", () => {
  it("空ならメッセージは作らない", () => {
    expect(buildTodoDigestMessages({ memos: [], appUrl: APP_URL })).toEqual([]);
  });

  it("入り切らなければ他N件はWebでとAPP_URLを付ける", () => {
    const longUrl = `https://example.com/${"u".repeat(2400)}`;
    const memos = Array.from({ length: 12 }, (_, index) =>
      memo({
        content: longUrl,
        mediaType: "url",
        createdAt: new Date(
          Date.parse("2026-09-07T00:00:00.000Z") + index * 60_000,
        ).toISOString(),
      }),
    );

    const messages = buildTodoDigestMessages({ memos, appUrl: APP_URL });
    expect(messages).toHaveLength(5);
    expect(messages.every((text) => text.length <= DIGEST_TEXT_LIMIT)).toBe(
      true,
    );
    expect((messages[0] ?? "").startsWith("未完了のTODO 12件")).toBe(true);
    expect(messages.join("\n")).toContain("他2件は Web で");
    expect(messages[4]).toContain(APP_URL);
    expect(messages.slice(0, 4).join("\n")).not.toContain(APP_URL);
  });
});
