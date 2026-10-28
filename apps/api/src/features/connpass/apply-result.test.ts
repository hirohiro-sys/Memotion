import { describe, expect, it } from "vitest";
import {
  classifyApplyError,
  isSameNickname,
  summarizeApply,
} from "./apply-result";

describe("classifyApplyError", () => {
  it("is unique for a UNIQUE constraint failure", () => {
    expect(
      classifyApplyError(
        new Error(
          "UNIQUE constraint failed: connpass_imports.user_id, connpass_imports.event_id: SQLITE_CONSTRAINT",
        ),
      ),
    ).toBe("unique");
    expect(classifyApplyError("UNIQUE constraint failed: x")).toBe("unique");
  });

  it("is an error for anything else", () => {
    expect(classifyApplyError(new Error("D1_ERROR: database is locked"))).toBe(
      "error",
    );
    expect(classifyApplyError(new Error("FOREIGN KEY constraint failed"))).toBe(
      "error",
    );
    expect(classifyApplyError(undefined)).toBe("error");
  });
});

describe("summarizeApply", () => {
  it("is success with no outcomes", () => {
    expect(summarizeApply([])).toEqual({ status: "success", failedActions: 0 });
  });

  it("does not count a unique violation as a failure", () => {
    expect(summarizeApply(["ok", "unique", "ok"])).toEqual({
      status: "success",
      failedActions: 0,
    });
  });

  it("is failed when any other error happened, and counts them", () => {
    expect(summarizeApply(["ok", "error", "unique", "error"])).toEqual({
      status: "failed",
      failedActions: 2,
    });
  });
});

describe("isSameNickname", () => {
  it("is true only for the identical saved nickname", () => {
    expect(isSameNickname("taro", "taro")).toBe(true);
    expect(isSameNickname("Taro", "taro")).toBe(false);
    expect(isSameNickname(null, "taro")).toBe(false);
    expect(isSameNickname(undefined, "taro")).toBe(false);
  });
});
