import { describe, expect, it } from "vitest";
import { jstToday } from "./jst";

describe("jstToday", () => {
  it("UTC の 14:59 は、JST では同じ日の 23:59", () => {
    expect(jstToday(new Date("2026-11-23T14:59:59Z"))).toBe("2026-11-23");
  });

  it("UTC の 15:00 は、JST では次の日の 0:00", () => {
    expect(jstToday(new Date("2026-11-23T15:00:00Z"))).toBe("2026-11-24");
  });

  it("年をまたぐ", () => {
    expect(jstToday(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});
