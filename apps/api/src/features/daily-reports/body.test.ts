import { MAX_DAILY_REPORT_BODY } from "@repo/shared";
import { describe, expect, it } from "vitest";
import {
  bodyWithinLimit,
  isModelTextEmpty,
  joinBody,
  withHeading,
} from "./body";

describe("joinBody", () => {
  it("inserts one blank line when neither side has extra newlines", () => {
    expect(joinBody("a", "b")).toBe("a\n\nb");
  });

  it("strips newlines only at the join and keeps the middle of each side", () => {
    expect(joinBody("a\n\nb\n", "\nc\nd")).toBe("a\n\nb\n\nc\nd");
  });

  it("collapses several join newlines into one blank line", () => {
    expect(joinBody("a\n\n\n", "\n\nb")).toBe("a\n\nb");
  });

  it("keeps spaces in the middle of a line", () => {
    expect(joinBody("a b", "c  d")).toBe("a b\n\nc  d");
  });
});

describe("isModelTextEmpty", () => {
  it("treats whitespace as empty", () => {
    expect(isModelTextEmpty(" \n\t")).toBe(true);
  });

  it("keeps a non-blank model line", () => {
    expect(isModelTextEmpty(" x ")).toBe(false);
  });
});

describe("withHeading", () => {
  it("puts the heading on the first line and leaves the model text below", () => {
    expect(withHeading("10月29日（木） 仕事", "本文\n次")).toBe(
      "10月29日（木） 仕事\n本文\n次",
    );
  });
});

describe("bodyWithinLimit", () => {
  it("accepts 20000 characters and rejects 20001", () => {
    expect(bodyWithinLimit("あ".repeat(MAX_DAILY_REPORT_BODY))).toBe(true);
    expect(bodyWithinLimit("あ".repeat(MAX_DAILY_REPORT_BODY + 1))).toBe(false);
  });

  it("counts the heading line toward the same limit", () => {
    const heading = "10月29日（木） 仕事";
    const room = MAX_DAILY_REPORT_BODY - heading.length - 1;
    expect(bodyWithinLimit(withHeading(heading, "あ".repeat(room)))).toBe(true);
    expect(bodyWithinLimit(withHeading(heading, "あ".repeat(room + 1)))).toBe(
      false,
    );
  });
});
