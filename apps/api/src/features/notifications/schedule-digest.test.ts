import { describe, expect, it } from "vitest";
import { afterSchedulePush, decideScheduleDigest } from "./schedule-digest";
import {
  DEFAULT_SCHEDULE_DAILY,
  type StoredScheduleSettings,
  UNREACHABLE_DISABLED_REASON,
} from "./settings";

// JST の時刻を UTC の Date にする。
function jst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

function settings(
  overrides: Partial<StoredScheduleSettings> = {},
): StoredScheduleSettings {
  return { ...DEFAULT_SCHEDULE_DAILY, ...overrides };
}

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
    ["2026-11-02T19:59:59", null, { action: "skip", reason: "not_due" }],
    [
      "2026-11-02T20:00:00",
      "2026-11-02",
      { action: "send", targetDate: "2026-11-03" },
    ],
    ["2026-11-02T20:00:00", null, { action: "send", targetDate: "2026-11-03" }],
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
    ["2026-11-03T00:10:00", null, { action: "skip", reason: "not_due" }],
    [
      "2026-11-03T00:11:00",
      "2026-11-03",
      { action: "skip", reason: "already" },
    ],
  ])("at %s with last_target_date %s", (now, lastTargetDate, expected) => {
    expect(
      decideScheduleDigest({
        settings: settings({ lastTargetDate }),
        now: jst(now),
      }),
    ).toEqual(expected);
  });

  it("skips a disabled setting whatever else holds", () => {
    for (const lastTargetDate of [null, "2026-11-01", "2026-11-02"]) {
      expect(
        decideScheduleDigest({
          settings: settings({ enabled: false, lastTargetDate }),
          now: jst("2026-11-02T20:00:00"),
        }),
      ).toEqual({ action: "skip", reason: "disabled" });
    }
  });

  it("does not resend the same target date after the time changes", () => {
    expect(
      decideScheduleDigest({
        settings: settings({ time: "21:00", lastTargetDate: "2026-11-03" }),
        now: jst("2026-11-02T21:00:00"),
      }),
    ).toEqual({ action: "skip", reason: "already" });
  });

  it("sends at 00:00 for the next day", () => {
    expect(
      decideScheduleDigest({
        settings: settings({ time: "00:00", lastTargetDate: "2026-11-02" }),
        now: jst("2026-11-02T00:00:00"),
      }),
    ).toEqual({ action: "send", targetDate: "2026-11-03" });
  });

  it("looks back to yesterday's 23:59 one minute before it", () => {
    const now = jst("2026-11-02T23:58:00");
    const at = (lastTargetDate: string | null) =>
      decideScheduleDigest({
        settings: settings({ time: "23:59", lastTargetDate }),
        now,
      });
    expect(at(null)).toEqual({ action: "skip", reason: "not_due" });
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

  it("turns the setting off without reverting when LINE is unreachable", () => {
    expect(afterSchedulePush("unreachable", "2026-11-02")).toEqual({
      action: "disable",
      disabledReason: UNREACHABLE_DISABLED_REASON,
    });
  });
});
