import { describe, expect, it } from "vitest";
import { memoImageKey } from "./repository";

describe("memoImageKey", () => {
  it("uses {userId}/{memoId} and does not store a public URL", () => {
    expect(memoImageKey("user_1", "memo_1")).toBe("user_1/memo_1");
  });
});
