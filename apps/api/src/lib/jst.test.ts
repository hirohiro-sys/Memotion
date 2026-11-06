import { describe, expect, it } from "vitest";
import {
  formatDateMd,
  formatJstMd,
  formatJstMdHm,
  fromJst,
  jstDateString,
  jstParts,
  nextDateString,
} from "./jst";

describe("jstParts", () => {
  it("reads the JST calendar fields at JST midnight", () => {
    expect(jstParts(new Date("2026-10-27T15:00:00Z"))).toEqual({
      year: 2026,
      month: 10,
      day: 28,
      weekday: 3,
      hour: 0,
      minute: 0,
    });
  });

  it("stays on the previous JST day one minute before midnight", () => {
    expect(jstParts(new Date("2026-10-27T14:59:00Z"))).toEqual({
      year: 2026,
      month: 10,
      day: 27,
      weekday: 2,
      hour: 23,
      minute: 59,
    });
  });

  it("crosses the year in JST", () => {
    const parts = jstParts(new Date("2026-12-31T15:00:00Z"));
    expect([parts.year, parts.month, parts.day]).toEqual([2027, 1, 1]);
  });
});

describe("fromJst", () => {
  it("returns the instant of a JST wall-clock time", () => {
    expect(fromJst(2026, 10, 28, 0, 0)).toEqual(
      new Date("2026-10-27T15:00:00Z"),
    );
    expect(fromJst(2026, 12, 31, 23, 59)).toEqual(
      new Date("2026-12-31T14:59:00Z"),
    );
  });

  it("is the inverse of jstParts", () => {
    const instant = new Date("2026-03-15T08:20:00Z");
    const parts = jstParts(instant);
    expect(
      fromJst(parts.year, parts.month, parts.day, parts.hour, parts.minute),
    ).toEqual(instant);
  });
});

describe("formatJstMd", () => {
  it("writes the JST month and day without zero padding", () => {
    expect(formatJstMd(new Date("2026-10-27T15:00:00Z"))).toBe("10/28");
    expect(formatJstMd(new Date("2026-01-04T15:00:00Z"))).toBe("1/5");
  });
});

describe("formatJstMdHm", () => {
  it("writes the JST date and a zero padded time", () => {
    expect(formatJstMdHm(new Date("2026-10-27T15:05:00Z"))).toBe("10/28 00:05");
    expect(formatJstMdHm(new Date("2026-10-28T03:30:00Z"))).toBe("10/28 12:30");
  });
});

describe("jstDateString", () => {
  it("returns the JST date", () => {
    expect(jstDateString(new Date("2026-10-27T15:00:00Z"))).toBe("2026-10-28");
    expect(jstDateString(new Date("2026-10-27T14:59:59Z"))).toBe("2026-10-27");
  });

  it("throws for a time that Date cannot represent after the JST shift", () => {
    expect(() => jstDateString(new Date(8.64e15))).toThrow(RangeError);
    expect(() => jstDateString(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("nextDateString", () => {
  it("returns the next calendar day", () => {
    expect(nextDateString("2026-10-27")).toBe("2026-10-28");
    expect(nextDateString("2026-12-31")).toBe("2027-01-01");
  });

  it("knows leap years", () => {
    expect(nextDateString("2028-02-28")).toBe("2028-02-29");
    expect(nextDateString("2026-02-28")).toBe("2026-03-01");
  });
});

describe("formatDateMd", () => {
  it("writes month and day without zero padding", () => {
    expect(formatDateMd("2026-11-03")).toBe("11/3");
    expect(formatDateMd("2026-01-05")).toBe("1/5");
  });
});
