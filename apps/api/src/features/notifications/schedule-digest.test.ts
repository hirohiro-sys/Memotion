import { describe, expect, it } from "vitest";
import { afterSchedulePush, decideScheduleDigest } from "./schedule-digest";

// JST の時刻を UTC の Date にする。
function jst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

const slot = { time: "20:00" };

describe("decideScheduleDigest at 20:00", () => {
  it.each([
    [
      "2026-11-02T19:59:59",
      "2026-11-02",
      { action: "skip", reason: "already" },
    ],
    [
      "2026-11-02T19:59:59",
      "2026-11-01",
      { action: "skip", reason: "stale", targetDate: "2026-11-02" },
    ],
    [
      "2026-11-02T19:59:59",
      null,
      { action: "baseline", targetDate: "2026-11-02" },
    ],
    [
      "2026-11-02T20:00:00",
      "2026-11-02",
      { action: "send", targetDate: "2026-11-03" },
    ],
    [
      "2026-11-02T20:00:00",
      null,
      { action: "baseline", targetDate: "2026-11-03" },
    ],
    [
      "2026-11-02T20:00:00",
      "2026-11-03",
      { action: "skip", reason: "already" },
    ],
    [
      "2026-11-02T20:00:00",
      "2026-11-04",
      { action: "skip", reason: "already" },
    ],
    [
      "2026-11-03T00:10:00",
      "2026-11-02",
      { action: "skip", reason: "stale", targetDate: "2026-11-03" },
    ],
    [
      "2026-11-03T00:10:00",
      null,
      { action: "baseline", targetDate: "2026-11-03" },
    ],
    [
      "2026-11-03T00:11:00",
      "2026-11-03",
      { action: "skip", reason: "already" },
    ],
  ])("at %s with last_target_date %s", (now, lastTargetDate, expected) => {
    expect(
      decideScheduleDigest({ slot, lastTargetDate, now: jst(now) }),
    ).toEqual(expected);
  });

  it("does not resend the same target date after the time changes", () => {
    expect(
      decideScheduleDigest({
        slot: { time: "21:00" },
        lastTargetDate: "2026-11-03",
        now: jst("2026-11-02T21:00:00"),
      }),
    ).toEqual({ action: "skip", reason: "already" });
  });

  it("sends at 00:00 for the next day", () => {
    expect(
      decideScheduleDigest({
        slot: { time: "00:00" },
        lastTargetDate: "2026-11-02",
        now: jst("2026-11-02T00:00:00"),
      }),
    ).toEqual({ action: "send", targetDate: "2026-11-03" });
  });

  it("looks back to yesterday's 23:59 one minute before it", () => {
    const now = jst("2026-11-02T23:58:00");
    const at = (lastTargetDate: string | null) =>
      decideScheduleDigest({ slot: { time: "23:59" }, lastTargetDate, now });
    expect(at(null)).toEqual({ action: "baseline", targetDate: "2026-11-02" });
    expect(at("2026-11-02")).toEqual({ action: "skip", reason: "already" });
    expect(at("2026-11-01")).toEqual({
      action: "skip",
      reason: "stale",
      targetDate: "2026-11-02",
    });
  });
});

describe("afterSchedulePush", () => {
  it("does nothing after a success", () => {
    expect(afterSchedulePush("success", "2026-11-02")).toEqual({
      action: "none",
    });
  });

  it("reverts to the previous target date after a transient failure", () => {
    expect(afterSchedulePush("transient", "2026-11-02")).toEqual({
      action: "revert",
      lastTargetDate: "2026-11-02",
    });
    expect(afterSchedulePush("transient", null)).toEqual({
      action: "revert",
      lastTargetDate: null,
    });
  });

  it("keeps the claim when LINE is unreachable so it does not retry every minute", () => {
    expect(afterSchedulePush("unreachable", "2026-11-02")).toEqual({
      action: "none",
    });
  });
});
