import { describe, expect, it } from "vitest";
import {
  isDueToSend,
  isInstantInWindow,
  latestDueAt,
  nextDigestWindow,
  windowEndingAt,
} from "./window";

const SUNDAY_20 = { weekday: 0, time: "20:00" } as const;
const WEDNESDAY_20 = { weekday: 3, time: "20:00" } as const;

function jst(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second) - 9 * 60 * 60 * 1000,
  );
}

describe("latestDueAt: Sunday 20:00 JST", () => {
  it("uses this Sunday 20:00 at the slot instant", () => {
    expect(latestDueAt(jst(2026, 9, 13, 20, 0), SUNDAY_20)).toEqual(
      jst(2026, 9, 13, 20, 0),
    );
  });

  it("stays on this Sunday after the slot (late cron)", () => {
    expect(latestDueAt(jst(2026, 9, 13, 20, 7), SUNDAY_20)).toEqual(
      jst(2026, 9, 13, 20, 0),
    );
  });

  it("falls back to last Sunday before the slot", () => {
    expect(latestDueAt(jst(2026, 9, 13, 19, 59), SUNDAY_20)).toEqual(
      jst(2026, 9, 6, 20, 0),
    );
  });

  it("uses yesterday's Sunday on Monday", () => {
    expect(latestDueAt(jst(2026, 9, 14, 10, 0), SUNDAY_20)).toEqual(
      jst(2026, 9, 13, 20, 0),
    );
  });
});

describe("isDueToSend", () => {
  const now = jst(2026, 9, 13, 20, 7);

  it("sends when last_sent_at is null", () => {
    expect(isDueToSend(now, SUNDAY_20, null)).toBe(true);
  });

  it("sends when last_sent_at is before the due instant", () => {
    expect(
      isDueToSend(now, SUNDAY_20, jst(2026, 9, 6, 20, 1).toISOString()),
    ).toBe(true);
  });

  it("does not send when last_sent_at equals the due instant", () => {
    expect(
      isDueToSend(now, SUNDAY_20, jst(2026, 9, 13, 20, 0).toISOString()),
    ).toBe(false);
  });

  it("does not send when last_sent_at is after the due instant", () => {
    expect(
      isDueToSend(now, SUNDAY_20, jst(2026, 9, 13, 20, 1).toISOString()),
    ).toBe(false);
  });
});

describe("windowEndingAt / isInstantInWindow", () => {
  const due = jst(2026, 9, 13, 20, 0);
  const window = windowEndingAt(due);

  it("is [due - 7 days, due)", () => {
    expect(window).toEqual({
      start: jst(2026, 9, 6, 20, 0),
      end: jst(2026, 9, 13, 20, 0),
    });
  });

  it("includes a memo at the window start", () => {
    expect(
      isInstantInWindow(jst(2026, 9, 6, 20, 0).toISOString(), window),
    ).toBe(true);
  });

  it("excludes a memo at the due instant (next week)", () => {
    expect(
      isInstantInWindow(jst(2026, 9, 13, 20, 0).toISOString(), window),
    ).toBe(false);
  });

  it("drops a memo from an older week", () => {
    expect(
      isInstantInWindow(jst(2026, 9, 6, 19, 59).toISOString(), window),
    ).toBe(false);
  });

  it("compares UTC created_at to the JST slot as instants", () => {
    expect(isInstantInWindow("2026-09-13T10:59:59.000Z", window)).toBe(true);
    expect(isInstantInWindow("2026-09-13T11:00:00.000Z", window)).toBe(false);
  });
});

describe("weekday change", () => {
  it("takes the latest Wednesday slot, not the old Sunday", () => {
    const now = jst(2026, 9, 16, 21, 0);
    expect(latestDueAt(now, WEDNESDAY_20)).toEqual(jst(2026, 9, 16, 20, 0));
    expect(isDueToSend(now, WEDNESDAY_20, now.toISOString())).toBe(false);
    expect(nextDigestWindow(now, WEDNESDAY_20, now.toISOString())).toEqual({
      start: jst(2026, 9, 16, 20, 0),
      end: jst(2026, 9, 23, 20, 0),
    });
  });
});

describe("nextDigestWindow", () => {
  it("uses the current due window while unsent", () => {
    expect(nextDigestWindow(jst(2026, 9, 13, 20, 7), SUNDAY_20, null)).toEqual({
      start: jst(2026, 9, 6, 20, 0),
      end: jst(2026, 9, 13, 20, 0),
    });
  });

  it("moves to the next slot after a successful send", () => {
    expect(
      nextDigestWindow(
        jst(2026, 9, 13, 20, 1),
        SUNDAY_20,
        jst(2026, 9, 13, 20, 1).toISOString(),
      ),
    ).toEqual({
      start: jst(2026, 9, 13, 20, 0),
      end: jst(2026, 9, 20, 20, 0),
    });
  });

  it("accumulates toward this Sunday when last week already sent", () => {
    expect(
      nextDigestWindow(
        jst(2026, 9, 12, 15, 0),
        SUNDAY_20,
        jst(2026, 9, 6, 20, 1).toISOString(),
      ),
    ).toEqual({
      start: jst(2026, 9, 6, 20, 0),
      end: jst(2026, 9, 13, 20, 0),
    });
  });
});
