import { describe, expect, it } from "vitest";
import {
  isPastScheduleDate,
  scheduleFields,
  validateCreateSchedule,
} from "./schedule";

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

describe("scheduleFields", () => {
  it("keeps the date and time of a timed schedule", () => {
    expect(
      scheduleFields({
        tag: "schedule",
        scheduledDate: "2026-11-03",
        scheduledTime: "14:00",
      }),
    ).toEqual({ scheduledDate: "2026-11-03", scheduledTime: "14:00" });
  });

  it.each([undefined, null, ""])(
    "keeps only the date of a schedule whose time is %j",
    (scheduledTime) => {
      expect(
        scheduleFields({
          tag: "schedule",
          scheduledDate: "2026-11-03",
          scheduledTime,
        }),
      ).toStrictEqual({ scheduledDate: "2026-11-03" });
    },
  );

  it.each([undefined, null, ""])(
    "drops the time of a schedule whose date is %j",
    (scheduledDate) => {
      expect(
        scheduleFields({
          tag: "schedule",
          scheduledDate,
          scheduledTime: "14:00",
        }),
      ).toStrictEqual({});
    },
  );

  it("drops the date and time of a memo that is not a schedule", () => {
    expect(
      scheduleFields({
        tag: "todo",
        scheduledDate: "2026-11-03",
        scheduledTime: "14:00",
      }),
    ).toStrictEqual({});
  });
});
