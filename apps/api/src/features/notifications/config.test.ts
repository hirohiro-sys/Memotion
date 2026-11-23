import { describe, expect, it } from "vitest";
import { parseDailySetting, parseWeeklySetting } from "./config";

describe("parseDailySetting", () => {
  it("reads a clock time", () => {
    expect(parseDailySetting("08:00")).toEqual({
      state: "on",
      slot: { time: "08:00" },
    });
    expect(parseDailySetting(" 23:59 ")).toEqual({
      state: "on",
      slot: { time: "23:59" },
    });
  });

  it("is off when missing or blank", () => {
    expect(parseDailySetting(undefined)).toEqual({ state: "off" });
    expect(parseDailySetting("  ")).toEqual({ state: "off" });
  });

  it("is invalid for times out of range or without a leading zero", () => {
    expect(parseDailySetting("24:00")).toEqual({ state: "invalid" });
    expect(parseDailySetting("8:00")).toEqual({ state: "invalid" });
    expect(parseDailySetting("08:60")).toEqual({ state: "invalid" });
  });
});

describe("parseWeeklySetting", () => {
  it("reads a weekday and a clock time", () => {
    expect(parseWeeklySetting("sun 20:00")).toEqual({
      state: "on",
      slot: { weekday: 0, time: "20:00" },
    });
    expect(parseWeeklySetting("SAT  00:00")).toEqual({
      state: "on",
      slot: { weekday: 6, time: "00:00" },
    });
  });

  it("is off when missing or blank", () => {
    expect(parseWeeklySetting(undefined)).toEqual({ state: "off" });
    expect(parseWeeklySetting("")).toEqual({ state: "off" });
  });

  it("is invalid for an unknown weekday, a missing time, or extra words", () => {
    expect(parseWeeklySetting("sunday 20:00")).toEqual({ state: "invalid" });
    expect(parseWeeklySetting("sun")).toEqual({ state: "invalid" });
    expect(parseWeeklySetting("sun 20:00 jst")).toEqual({ state: "invalid" });
    expect(parseWeeklySetting("sun 25:00")).toEqual({ state: "invalid" });
  });
});
