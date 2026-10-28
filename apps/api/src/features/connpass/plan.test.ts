import { describe, expect, it } from "vitest";
import { toJstSchedule } from "./event-schedule";
import { type ConnpassEvent, type ImportRow, planConnpassSync } from "./plan";

const TODAY = "2026-10-28";
const RANGE_END = "2027-10-31";

function event(overrides: Partial<ConnpassEvent> = {}): ConnpassEvent {
  return {
    id: 1,
    title: "勉強会",
    startedAt: "2026-11-03T19:00:00+09:00",
    openStatus: "open",
    ...overrides,
  };
}

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    eventId: 1,
    memoId: "memo_1",
    importedTitle: "勉強会",
    importedDate: "2026-11-03",
    importedTime: "19:00",
    ...overrides,
  };
}

function plan(input: {
  events?: ConnpassEvent[];
  imports?: ImportRow[];
  complete?: boolean;
}) {
  return planConnpassSync({
    events: input.events ?? [],
    complete: input.complete ?? true,
    imports: input.imports ?? [],
    today: TODAY,
    rangeEnd: RANGE_END,
    toSchedule: toJstSchedule,
  });
}

describe("planConnpassSync: create", () => {
  it("creates a schedule for an event that is not in the table", () => {
    expect(plan({ events: [event()] })).toEqual([
      {
        type: "create",
        eventId: 1,
        values: { title: "勉強会", date: "2026-11-03", time: "19:00" },
      },
    ]);
  });

  it("trims the title and does not create one that is blank", () => {
    expect(plan({ events: [event({ title: "  \n " })] })).toEqual([]);
    const [action] = plan({ events: [event({ title: "  勉強会  " })] });
    expect(action).toMatchObject({ values: { title: "勉強会" } });
  });

  it("does not split an emoji when cutting the title", () => {
    const [action] = plan({
      events: [event({ title: `${"あ".repeat(199)}😀😀` })],
    });
    const title = action?.type === "create" ? action.values.title : "";
    expect(Array.from(title)).toHaveLength(200);
    expect(title.endsWith("😀")).toBe(true);
  });

  it("does not split a ZWJ emoji or a flag when cutting the title", () => {
    for (const unit of ["👨‍👩‍👧", "🇯🇵"]) {
      const [action] = plan({
        events: [event({ title: `${"あ".repeat(199)}${unit}${unit}` })],
      });
      const title = action?.type === "create" ? action.values.title : "";
      expect(title).toBe(`${"あ".repeat(199)}${unit}`);
    }
  });

  it("cuts a long title to 200 characters", () => {
    const [action] = plan({ events: [event({ title: "あ".repeat(300) })] });
    expect(action?.type === "create" && action.values.title).toHaveLength(200);
  });

  it("creates an event that starts today but not one that started yesterday", () => {
    expect(
      plan({ events: [event({ startedAt: "2026-10-28T00:00:00+09:00" })] }),
    ).toHaveLength(1);
    expect(
      plan({ events: [event({ startedAt: "2026-10-27T23:59:00+09:00" })] }),
    ).toEqual([]);
  });

  it("skips an event without a start time or with an unreadable one", () => {
    expect(plan({ events: [event({ startedAt: null })] })).toEqual([]);
    expect(plan({ events: [event({ startedAt: "garbage" })] })).toEqual([]);
  });

  it("does not create a cancelled event", () => {
    expect(plan({ events: [event({ openStatus: "cancelled" })] })).toEqual([]);
  });

  it("handles the same event id once", () => {
    expect(plan({ events: [event(), event()] })).toHaveLength(1);
  });
});

describe("planConnpassSync: update", () => {
  it("does nothing when the values are the same", () => {
    expect(plan({ events: [event()], imports: [row()] })).toEqual([]);
  });

  it("updates when the title changed", () => {
    expect(
      plan({ events: [event({ title: "新しい名前" })], imports: [row()] }),
    ).toEqual([
      {
        type: "update",
        eventId: 1,
        memoId: "memo_1",
        values: { title: "新しい名前", date: "2026-11-03", time: "19:00" },
      },
    ]);
  });

  it("updates when only the date changed", () => {
    const [action] = plan({
      events: [event({ startedAt: "2026-11-04T19:00:00+09:00" })],
      imports: [row()],
    });
    expect(action).toMatchObject({
      type: "update",
      values: { date: "2026-11-04", time: "19:00" },
    });
  });

  it("updates when only the time changed", () => {
    const [action] = plan({
      events: [event({ startedAt: "2026-11-03T20:00:00+09:00" })],
      imports: [row()],
    });
    expect(action).toMatchObject({
      type: "update",
      values: { date: "2026-11-03", time: "20:00" },
    });
  });

  it("does nothing for an event the user deleted, even if it changed", () => {
    expect(
      plan({
        events: [event({ title: "新しい名前" })],
        imports: [row({ memoId: null })],
      }),
    ).toEqual([]);
  });

  it("keeps the previous title but follows the date when the title became blank", () => {
    expect(plan({ events: [event({ title: " " })], imports: [row()] })).toEqual(
      [],
    );
    const [action] = plan({
      events: [event({ title: " ", startedAt: "2026-11-04T19:00:00+09:00" })],
      imports: [row()],
    });
    expect(action).toEqual({
      type: "update",
      eventId: 1,
      memoId: "memo_1",
      values: { title: "勉強会", date: "2026-11-04", time: "19:00" },
    });
  });
});

describe("planConnpassSync: cancelled", () => {
  it("deletes the schedule of a cancelled event", () => {
    expect(
      plan({
        events: [event({ openStatus: "cancelled" })],
        imports: [row()],
      }),
    ).toEqual([{ type: "delete", eventId: 1, memoId: "memo_1" }]);
  });

  it("does nothing for a cancelled event whose schedule the user deleted", () => {
    expect(
      plan({
        events: [event({ openStatus: "cancelled" })],
        imports: [row({ memoId: null })],
      }),
    ).toEqual([]);
  });

  it("deletes a cancelled event even if the fetch was incomplete", () => {
    expect(
      plan({
        events: [event({ openStatus: "cancelled" })],
        imports: [row()],
        complete: false,
      }),
    ).toEqual([{ type: "delete", eventId: 1, memoId: "memo_1" }]);
  });
});

describe("planConnpassSync: missing from the result", () => {
  it("deletes a future schedule that is gone from a complete result", () => {
    expect(plan({ events: [], imports: [row()] })).toEqual([
      { type: "delete", eventId: 1, memoId: "memo_1" },
    ]);
  });

  it("does not delete when the fetch was incomplete", () => {
    expect(plan({ events: [], imports: [row()], complete: false })).toEqual([]);
  });

  it("keeps a schedule that already took place", () => {
    expect(plan({ imports: [row({ importedDate: "2026-10-27" })] })).toEqual(
      [],
    );
  });

  it("deletes a schedule of today that is gone", () => {
    expect(plan({ imports: [row({ importedDate: TODAY })] })).toEqual([
      { type: "delete", eventId: 1, memoId: "memo_1" },
    ]);
  });

  it("keeps a schedule beyond the fetched range", () => {
    expect(plan({ imports: [row({ importedDate: "2027-11-01" })] })).toEqual(
      [],
    );
    expect(plan({ imports: [row({ importedDate: RANGE_END })] })).toHaveLength(
      1,
    );
  });

  it("does not delete a schedule whose event now has no readable start time", () => {
    expect(
      plan({ events: [event({ startedAt: null })], imports: [row()] }),
    ).toEqual([]);
    expect(
      plan({ events: [event({ startedAt: "garbage" })], imports: [row()] }),
    ).toEqual([]);
  });

  it("does nothing for a deleted one that is gone", () => {
    expect(plan({ imports: [row({ memoId: null })] })).toEqual([]);
  });

  it("deletes a schedule whose event moved to the past", () => {
    expect(
      plan({
        events: [event({ startedAt: "2026-10-01T19:00:00+09:00" })],
        imports: [row()],
      }),
    ).toEqual([{ type: "delete", eventId: 1, memoId: "memo_1" }]);
  });

  it("does not delete a schedule that is still in the result", () => {
    expect(plan({ events: [event()], imports: [row()] })).toEqual([]);
  });
});
