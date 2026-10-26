import { describe, expect, it } from "vitest";
import {
  isSameJstDayAsDue,
  scheduleTargetDate,
  scheduleTargetToMark,
} from "./window";

// JST の時刻を UTC の Date にする。
function jst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

describe("scheduleTargetDate", () => {
  const slot = { time: "00:30" };

  it("is the day after the latest due time", () => {
    expect(scheduleTargetDate(jst("2026-11-02T00:29:00"), slot)).toBe(
      "2026-11-02",
    );
    expect(scheduleTargetDate(jst("2026-11-02T00:30:00"), slot)).toBe(
      "2026-11-03",
    );
  });

  it("crosses months, years and leap days", () => {
    expect(scheduleTargetDate(jst("2026-11-30T21:00:00"), slot)).toBe(
      "2026-12-01",
    );
    expect(scheduleTargetDate(jst("2026-12-31T21:00:00"), slot)).toBe(
      "2027-01-01",
    );
    expect(scheduleTargetDate(jst("2028-02-28T21:00:00"), slot)).toBe(
      "2028-02-29",
    );
    expect(scheduleTargetDate(jst("2027-02-28T21:00:00"), slot)).toBe(
      "2027-03-01",
    );
  });
});

describe("scheduleTargetToMark", () => {
  const slot = { time: "20:00" };

  it("is null until today's time comes", () => {
    expect(scheduleTargetToMark(jst("2026-11-02T19:59:59"), slot)).toBeNull();
    expect(scheduleTargetToMark(jst("2026-11-02T20:00:00"), slot)).toBe(
      "2026-11-03",
    );
  });

  it("crosses the year", () => {
    expect(scheduleTargetToMark(jst("2026-12-31T21:00:00"), slot)).toBe(
      "2027-01-01",
    );
  });

  it("marks tomorrow when an earlier time has already passed today", () => {
    expect(
      scheduleTargetToMark(jst("2026-11-02T19:00:00"), { time: "08:00" }),
    ).toBe("2026-11-03");
  });
});

describe("isSameJstDayAsDue", () => {
  const slot = { time: "00:30" };

  it("is the same day until JST midnight", () => {
    expect(isSameJstDayAsDue(jst("2026-11-02T23:59:00"), slot)).toBe(true);
    expect(isSameJstDayAsDue(jst("2026-11-03T00:00:00"), slot)).toBe(false);
  });

  it("uses JST for UTC instants", () => {
    expect(isSameJstDayAsDue(new Date("2026-11-02T14:59:59Z"), slot)).toBe(
      true,
    );
    expect(isSameJstDayAsDue(new Date("2026-11-02T15:10:00Z"), slot)).toBe(
      false,
    );
  });
});
