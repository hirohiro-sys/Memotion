import { describe, expect, it } from "vitest";
import { memoMatchesQuery } from "./memo-search";

const dentist = {
  tag: "schedule" as const,
  content: "歯医者",
  scheduledDate: "2026-11-03",
  scheduledTime: "14:00",
};

const untimed = {
  tag: "schedule" as const,
  content: "歯医者",
  scheduledDate: "2026-11-03",
};

const friday = {
  tag: "schedule" as const,
  content: "会議",
  scheduledDate: "2026-11-13",
  scheduledTime: "09:00",
};

const monthEnd = {
  tag: "schedule" as const,
  content: "締め",
  scheduledDate: "2026-11-30",
  scheduledTime: "10:00",
};

const lastYear = {
  tag: "schedule" as const,
  content: "去年",
  scheduledDate: "2025-11-03",
  scheduledTime: "12:00",
};

describe("memoMatchesQuery", () => {
  it.each<[string, boolean]>([
    ["11月3日（火）", true],
    ["11月3日", true],
    ["（火）", true],
    ["14:00", true],
    ["11月3日（火） 14:00", true],
    ["11月3日（火）14:00", false],
    ["2026", false],
    ["2026-11-03", false],
    ["11月03日", false],
    ["11月3日(火)", false],
    ["時間未定", false],
    ["歯医者", true],
    ["   ", true],
    ["", true],
  ])("2026-11-03 14:00 dentist, query %j", (query, matches) => {
    expect(memoMatchesQuery(dentist, query)).toBe(matches);
  });

  it("matches 時間未定 when the schedule has no time", () => {
    expect(memoMatchesQuery(untimed, "時間未定")).toBe(true);
    expect(memoMatchesQuery(untimed, "14:00")).toBe(false);
  });

  it.each<[string, boolean]>([
    ["11月13日（金）", true],
    ["11月3日", false],
    ["3日", true],
  ])("2026-11-13 09:00, query %j", (query, matches) => {
    expect(memoMatchesQuery(friday, query)).toBe(matches);
  });

  it("does not treat 30日 as 3日", () => {
    expect(memoMatchesQuery(monthEnd, "3日")).toBe(false);
  });

  it.each<[string, boolean]>([
    ["11月3日", true],
    ["（月）", true],
    ["（火）", false],
  ])("2025-11-03, query %j", (query, matches) => {
    expect(memoMatchesQuery(lastYear, query)).toBe(matches);
  });

  it("matches a url without matching its letter case", () => {
    expect(
      memoMatchesQuery(
        {
          tag: "tech" as const,
          content: "資料",
          url: "https://Example.com/A",
        },
        "example.com",
      ),
    ).toBe(true);
  });

  it("matches a date that is written in the body", () => {
    expect(
      memoMatchesQuery(
        { tag: "todo" as const, content: "11月3日に買う" },
        "11月3日",
      ),
    ).toBe(true);
  });

  it("does not match a schedule line the body does not contain", () => {
    const todo = { tag: "todo" as const, content: "買う" };
    expect(memoMatchesQuery(todo, "11月3日")).toBe(false);
    expect(memoMatchesQuery(todo, "時間未定")).toBe(false);
  });

  it("ignores a date on a memo whose tag is not schedule", () => {
    const dated = {
      tag: "todo" as const,
      content: "買い物",
      scheduledDate: "2026-11-03",
      scheduledTime: "14:00",
    };
    expect(memoMatchesQuery(dated, "11月3日（火）")).toBe(false);
    expect(memoMatchesQuery(dated, "買い物")).toBe(true);
  });

  it("matches a pending item by content only", () => {
    const pending = { tag: "tweet" as const, content: "下書き" };
    expect(memoMatchesQuery(pending, "下書き")).toBe(true);
    expect(memoMatchesQuery(pending, "11月3日")).toBe(false);
  });
});
