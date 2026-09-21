import { describe, expect, it } from "vitest";
import { isDueToSend, latestDailyDueAt } from "./window";

const DAILY_08 = { time: "08:00" } as const;

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

describe("latestDailyDueAt: 毎日08:00の通知枠", () => {
  it("今が08:00ちょうどなら、いちばん新しい通知枠は今日の08:00", () => {
    expect(latestDailyDueAt(jst(2026, 9, 15, 8, 0), DAILY_08)).toEqual(
      jst(2026, 9, 15, 8, 0),
    );
  });

  it("今が07:59なら、いちばん新しい通知枠は昨日の08:00", () => {
    expect(latestDailyDueAt(jst(2026, 9, 15, 7, 59), DAILY_08)).toEqual(
      jst(2026, 9, 14, 8, 0),
    );
  });
});

describe("isDueToSend: 毎日08:00の通知を今送るか", () => {
  const now = jst(2026, 9, 15, 8, 7);

  it("一度も送っていなければ送る", () => {
    expect(isDueToSend(now, DAILY_08, null)).toBe(true);
  });

  it("今日の08:00以降に送済みなら送らない", () => {
    expect(
      isDueToSend(now, DAILY_08, jst(2026, 9, 15, 8, 1).toISOString()),
    ).toBe(false);
  });

  it("昨日は送ったが今日の08:00は未送信なら送る", () => {
    expect(
      isDueToSend(now, DAILY_08, jst(2026, 9, 14, 8, 1).toISOString()),
    ).toBe(true);
  });
});
