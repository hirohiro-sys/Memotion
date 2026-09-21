import { describe, expect, it } from "vitest";
import {
  applySettingsPatch,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_TECH_WEEKLY,
  DEFAULT_TODO_DAILY,
  toNotificationSettings,
} from "./settings";

const now = new Date("2026-09-15T08:00:00.000Z");
const nowIso = now.toISOString();

describe("applySettingsPatch", () => {
  it("keeps defaults and does not insert a sent mark on an empty patch", () => {
    expect(applySettingsPatch(null, {}, now)).toEqual(
      DEFAULT_NOTIFICATION_SETTINGS,
    );
  });

  it("advances last_sent_at when turning on so the previous window is dropped", () => {
    expect(
      applySettingsPatch(
        {
          techWeekly: {
            ...DEFAULT_TECH_WEEKLY,
            enabled: false,
            lastSentAt: "2026-09-06T11:00:00.000Z",
            disabledReason:
              "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
          },
          todoDaily: DEFAULT_TODO_DAILY,
        },
        { techWeeklyEnabled: true },
        now,
      ),
    ).toEqual({
      techWeekly: {
        ...DEFAULT_TECH_WEEKLY,
        enabled: true,
        lastSentAt: nowIso,
        disabledReason: null,
      },
      todoDaily: DEFAULT_TODO_DAILY,
    });
  });

  it("clears the auto-off reason when the user turns the toggle off", () => {
    expect(
      applySettingsPatch(
        {
          techWeekly: {
            ...DEFAULT_TECH_WEEKLY,
            disabledReason:
              "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
          },
          todoDaily: DEFAULT_TODO_DAILY,
        },
        { techWeeklyEnabled: false },
        now,
      ),
    ).toEqual({
      techWeekly: {
        ...DEFAULT_TECH_WEEKLY,
        enabled: false,
        lastSentAt: null,
        disabledReason: null,
      },
      todoDaily: DEFAULT_TODO_DAILY,
    });
  });

  it("advances last_sent_at when the weekday or time changes", () => {
    expect(
      applySettingsPatch(
        DEFAULT_NOTIFICATION_SETTINGS,
        { techWeeklyDay: 3 },
        now,
      ).techWeekly.lastSentAt,
    ).toBe(nowIso);
    expect(
      applySettingsPatch(
        DEFAULT_NOTIFICATION_SETTINGS,
        { techWeeklyTime: "21:00" },
        now,
      ).techWeekly.lastSentAt,
    ).toBe(nowIso);
  });

  it("does not advance last_sent_at when the same weekday is sent again", () => {
    expect(
      applySettingsPatch(
        {
          techWeekly: {
            ...DEFAULT_TECH_WEEKLY,
            lastSentAt: "2026-09-13T11:01:00.000Z",
          },
          todoDaily: DEFAULT_TODO_DAILY,
        },
        { techWeeklyDay: 0 },
        now,
      ).techWeekly.lastSentAt,
    ).toBe("2026-09-13T11:01:00.000Z");
  });

  it("TODOをオンにすると日次のlastSentAtだけnowになる", () => {
    const next = applySettingsPatch(
      {
        techWeekly: {
          ...DEFAULT_TECH_WEEKLY,
          lastSentAt: "2026-09-13T11:01:00.000Z",
        },
        todoDaily: {
          ...DEFAULT_TODO_DAILY,
          enabled: false,
          lastSentAt: "2026-09-14T23:00:00.000Z",
        },
      },
      { todoDailyEnabled: true },
      now,
    );
    expect(next.todoDaily.enabled).toBe(true);
    expect(next.todoDaily.lastSentAt).toBe(nowIso);
    expect(next.techWeekly.lastSentAt).toBe("2026-09-13T11:01:00.000Z");
  });

  it("TODOの時刻を変えると日次のlastSentAtだけnowになる", () => {
    const next = applySettingsPatch(
      {
        techWeekly: {
          ...DEFAULT_TECH_WEEKLY,
          lastSentAt: "2026-09-13T11:01:00.000Z",
        },
        todoDaily: {
          ...DEFAULT_TODO_DAILY,
          lastSentAt: "2026-09-14T23:00:00.000Z",
        },
      },
      { todoDailyTime: "09:00" },
      now,
    );
    expect(next.todoDaily.time).toBe("09:00");
    expect(next.todoDaily.lastSentAt).toBe(nowIso);
    expect(next.techWeekly.lastSentAt).toBe("2026-09-13T11:01:00.000Z");
  });
});

describe("toNotificationSettings", () => {
  it("maps stored columns to the GET shape", () => {
    expect(
      toNotificationSettings(
        {
          techWeekly: {
            ...DEFAULT_TECH_WEEKLY,
            enabled: false,
            weekday: 3,
            time: "21:00",
            lastSentAt: nowIso,
            disabledReason:
              "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
          },
          todoDaily: DEFAULT_TODO_DAILY,
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

  it("日次の保存値をGETの形に載せる", () => {
    expect(
      toNotificationSettings(
        {
          techWeekly: DEFAULT_TECH_WEEKLY,
          todoDaily: {
            ...DEFAULT_TODO_DAILY,
            enabled: false,
            time: "09:00",
            disabledReason:
              "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
          },
        },
        4,
      ),
    ).toEqual({
      techWeeklyEnabled: true,
      techWeeklyDay: 0,
      techWeeklyTime: "20:00",
      pendingCount: 4,
      disabledReason: null,
      todoDailyEnabled: false,
      todoDailyTime: "09:00",
      todoPendingCount: 0,
      todoDisabledReason:
        "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
    });
  });
});
