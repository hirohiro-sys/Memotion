import { describe, expect, it } from "vitest";
import {
  applySettingsPatch,
  DEFAULT_TECH_WEEKLY,
  toNotificationSettings,
} from "./settings";

const now = new Date("2026-09-15T08:00:00.000Z");
const nowIso = now.toISOString();

describe("applySettingsPatch", () => {
  it("keeps defaults and does not insert a sent mark on an empty patch", () => {
    expect(applySettingsPatch(null, {}, now)).toEqual(DEFAULT_TECH_WEEKLY);
  });

  it("advances last_sent_at when turning on so the previous window is dropped", () => {
    expect(
      applySettingsPatch(
        {
          ...DEFAULT_TECH_WEEKLY,
          enabled: false,
          lastSentAt: "2026-09-06T11:00:00.000Z",
          disabledReason:
            "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
        },
        { techWeeklyEnabled: true },
        now,
      ),
    ).toEqual({
      ...DEFAULT_TECH_WEEKLY,
      enabled: true,
      lastSentAt: nowIso,
      disabledReason: null,
    });
  });

  it("clears the auto-off reason when the user turns the toggle off", () => {
    expect(
      applySettingsPatch(
        {
          ...DEFAULT_TECH_WEEKLY,
          disabledReason:
            "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
        },
        { techWeeklyEnabled: false },
        now,
      ),
    ).toEqual({
      ...DEFAULT_TECH_WEEKLY,
      enabled: false,
      lastSentAt: null,
      disabledReason: null,
    });
  });

  it("advances last_sent_at when the weekday or time changes", () => {
    expect(
      applySettingsPatch(DEFAULT_TECH_WEEKLY, { techWeeklyDay: 3 }, now)
        .lastSentAt,
    ).toBe(nowIso);
    expect(
      applySettingsPatch(DEFAULT_TECH_WEEKLY, { techWeeklyTime: "21:00" }, now)
        .lastSentAt,
    ).toBe(nowIso);
  });

  it("does not advance last_sent_at when the same weekday is sent again", () => {
    expect(
      applySettingsPatch(
        { ...DEFAULT_TECH_WEEKLY, lastSentAt: "2026-09-13T11:01:00.000Z" },
        { techWeeklyDay: 0 },
        now,
      ).lastSentAt,
    ).toBe("2026-09-13T11:01:00.000Z");
  });
});

describe("toNotificationSettings", () => {
  it("maps stored columns to the GET shape", () => {
    expect(
      toNotificationSettings(
        {
          enabled: false,
          weekday: 3,
          time: "21:00",
          lastSentAt: nowIso,
          disabledReason:
            "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
        },
        4,
      ),
    ).toEqual({
      techWeeklyEnabled: false,
      techWeeklyDay: 3,
      techWeeklyTime: "21:00",
      pendingCount: 4,
      disabledReason:
        "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
      todoDailyEnabled: true,
      todoDailyTime: "08:00",
      todoPendingCount: 0,
      todoDisabledReason: null,
    });
  });
});
