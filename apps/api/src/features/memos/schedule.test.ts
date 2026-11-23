import { describe, expect, it } from "vitest";
import { isPastScheduleDate, validateCreateSchedule } from "./schedule";

describe("isPastScheduleDate", () => {
  it("treats today in JST as not past until JST midnight", () => {
    const lastSecond = new Date("2026-11-02T14:59:59Z");
    expect(isPastScheduleDate("2026-11-02", lastSecond)).toBe(false);

    const midnight = new Date("2026-11-02T15:00:00Z");
    expect(isPastScheduleDate("2026-11-02", midnight)).toBe(true);
    expect(isPastScheduleDate("2026-11-03", midnight)).toBe(false);
  });

  it("crosses the year in JST", () => {
    expect(
      isPastScheduleDate("2026-12-31", new Date("2026-12-31T14:59:59Z")),
    ).toBe(false);
    expect(
      isPastScheduleDate("2026-12-31", new Date("2026-12-31T15:00:00Z")),
    ).toBe(true);
  });
});

describe("validateCreateSchedule", () => {
  const now = new Date("2026-11-02T03:00:00Z");

  it("rejects a past date", () => {
    expect(
      validateCreateSchedule(
        { tag: "schedule", scheduledDate: "2026-11-01" },
        now,
      ),
    ).toBe("past_date");
  });

  it("accepts today and later", () => {
    expect(
      validateCreateSchedule(
        { tag: "schedule", scheduledDate: "2026-11-02" },
        now,
      ),
    ).toBe("ok");
    expect(
      validateCreateSchedule(
        { tag: "schedule", scheduledDate: "2026-11-03" },
        now,
      ),
    ).toBe("ok");
  });

  it("does not look at dates for a memo that is not a schedule", () => {
    expect(
      validateCreateSchedule(
        { tag: "tweet", scheduledDate: "2026-11-01" },
        now,
      ),
    ).toBe("ok");
    expect(validateCreateSchedule({ tag: "tweet" }, now)).toBe("ok");
  });
});
