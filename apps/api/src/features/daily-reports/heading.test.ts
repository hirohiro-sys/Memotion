import { describe, expect, it, vi } from "vitest";
import { headingLine } from "./heading";

describe("headingLine", () => {
  it("formats a Thursday work report without the year", () => {
    expect(headingLine("2026-10-29", "work")).toBe("10月29日（木） 仕事");
  });

  it("formats a Friday personal report and drops the leading zero", () => {
    expect(headingLine("2026-01-02", "personal")).toBe("1月2日（金） 個人");
  });

  it("keeps the weekday of a leap day", () => {
    expect(headingLine("2024-02-29", "work")).toBe("2月29日（木） 仕事");
  });

  it("reads the weekday from the date string, not from Date.now", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(1999, 0, 1));
    expect(headingLine("2026-10-29", "work")).toBe("10月29日（木） 仕事");
    vi.restoreAllMocks();
  });
});
