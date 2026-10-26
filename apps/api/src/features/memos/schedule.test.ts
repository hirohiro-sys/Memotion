import { describe, expect, it } from "vitest";
import {
  decideScheduleSet,
  isPastScheduleDate,
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

describe("decideScheduleSet", () => {
  it("returns not_found for a missing memo", () => {
    expect(decideScheduleSet({ memo: null })).toBe("not_found");
  });

  it("accepts tweet and schedule outside a group", () => {
    expect(decideScheduleSet({ memo: { tag: "tweet", groupId: null } })).toBe(
      "ok",
    );
    expect(
      decideScheduleSet({ memo: { tag: "schedule", groupId: null } }),
    ).toBe("ok");
  });

  it.each(["tech", "todo", "other"])("rejects %s outside a group", (tag) => {
    expect(decideScheduleSet({ memo: { tag, groupId: null } })).toBe(
      "not_schedulable",
    );
  });

  it.each(["tweet", "schedule", "other"])(
    "rejects %s inside a group",
    (tag) => {
      expect(decideScheduleSet({ memo: { tag, groupId: "group_1" } })).toBe(
        "not_schedulable",
      );
    },
  );
});

describe("validateCreateSchedule", () => {
  const now = new Date("2026-11-02T03:00:00Z");

  it("rejects a schedule with a group", () => {
    expect(
      validateCreateSchedule(
        { tag: "schedule", groupId: "group_1", scheduledDate: "2026-11-03" },
        now,
      ),
    ).toBe("invalid");
  });

  it("rejects a past date, but a group wins first", () => {
    expect(
      validateCreateSchedule(
        { tag: "schedule", scheduledDate: "2026-11-01" },
        now,
      ),
    ).toBe("past_date");
    expect(
      validateCreateSchedule(
        { tag: "schedule", groupId: "group_1", scheduledDate: "2026-11-01" },
        now,
      ),
    ).toBe("invalid");
  });

  it("accepts today and later without a group", () => {
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

  it("accepts a plain memo in a group", () => {
    expect(
      validateCreateSchedule({ tag: "tweet", groupId: "group_1" }, now),
    ).toBe("ok");
  });
});
