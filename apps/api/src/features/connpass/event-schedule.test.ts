import { describe, expect, it } from "vitest";
import {
  fetchRangeEnd,
  jstDateString,
  monthsToFetch,
  toJstSchedule,
} from "./event-schedule";

describe("toJstSchedule", () => {
  it("keeps a +09:00 start as is", () => {
    expect(toJstSchedule("2026-11-03T19:00:00+09:00")).toEqual({
      date: "2026-11-03",
      time: "19:00",
    });
  });

  it("converts UTC to JST across the date boundary", () => {
    expect(toJstSchedule("2026-11-02T15:30:00Z")).toEqual({
      date: "2026-11-03",
      time: "00:30",
    });
  });

  it("converts another offset to JST", () => {
    expect(toJstSchedule("2026-11-03T00:00:00-05:00")).toEqual({
      date: "2026-11-03",
      time: "14:00",
    });
  });

  it("returns null for a time beyond the range of Date instead of throwing", () => {
    expect(toJstSchedule("+275760-09-13T00:00:00Z")).toBeNull();
  });

  it("returns null for an unreadable value", () => {
    expect(toJstSchedule("not a date")).toBeNull();
    expect(toJstSchedule("")).toBeNull();
  });
});

describe("monthsToFetch", () => {
  it("lists 13 months from the JST current month", () => {
    const months = monthsToFetch(new Date("2026-10-26T00:00:00Z"));
    expect(months).toHaveLength(13);
    expect(months[0]).toBe("202610");
    expect(months[12]).toBe("202710");
  });

  it("crosses the year end", () => {
    const months = monthsToFetch(new Date("2026-12-15T00:00:00Z"));
    expect(months[0]).toBe("202612");
    expect(months[1]).toBe("202701");
    expect(months[12]).toBe("202712");
  });

  it("uses the JST month at the month boundary", () => {
    // UTC ではまだ 10 月だが、JST では 11/1 の 00:30。
    const months = monthsToFetch(new Date("2026-10-31T15:30:00Z"));
    expect(months[0]).toBe("202611");
  });
});

describe("fetchRangeEnd", () => {
  it("is the last day of the 13th month", () => {
    expect(fetchRangeEnd(new Date("2026-10-26T00:00:00Z"))).toBe("2027-10-31");
    expect(fetchRangeEnd(new Date("2026-02-10T00:00:00Z"))).toBe("2027-02-28");
  });
});

describe("jstDateString", () => {
  it("returns the JST date", () => {
    expect(jstDateString(new Date("2026-10-27T15:00:00Z"))).toBe("2026-10-28");
    expect(jstDateString(new Date("2026-10-27T14:59:59Z"))).toBe("2026-10-27");
  });
});
