import { describe, expect, it } from "vitest";
import {
  applySettingsPatch,
  changedSections,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_SCHEDULE_DAILY,
  DEFAULT_TECH_WEEKLY,
  DEFAULT_TODO_DAILY,
  planScheduleSettingsChange,
  toNotificationSettings,
  UNREACHABLE_DISABLED_REASON,
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
        0,
        DEFAULT_SCHEDULE_DAILY,
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
      scheduleDailyEnabled: true,
      scheduleDailyTime: "20:00",
      scheduleDisabledReason: null,
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
        3,
        DEFAULT_SCHEDULE_DAILY,
      ),
    ).toEqual({
      techWeeklyEnabled: true,
      techWeeklyDay: 0,
      techWeeklyTime: "20:00",
      pendingCount: 4,
      disabledReason: null,
      todoDailyEnabled: false,
      todoDailyTime: "09:00",
      todoPendingCount: 3,
      todoDisabledReason:
        "LINEに送れなかったためオフにしました。友達追加を確認して、再度オンにしてください",
      scheduleDailyEnabled: true,
      scheduleDailyTime: "20:00",
      scheduleDisabledReason: null,
    });
  });
});

// JST の時刻を UTC の Date にする。
function jst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

describe("DEFAULT_SCHEDULE_DAILY", () => {
  it("is on at 20:00 with no processed target date", () => {
    expect(DEFAULT_SCHEDULE_DAILY).toEqual({
      enabled: true,
      time: "20:00",
      lastTargetDate: null,
      disabledReason: null,
    });
  });
});

describe("planScheduleSettingsChange", () => {
  const on = DEFAULT_SCHEDULE_DAILY;
  const off = { ...DEFAULT_SCHEDULE_DAILY, enabled: false };

  it("changes nothing for an empty patch", () => {
    expect(
      planScheduleSettingsChange(on, {}, jst("2026-11-02T21:00:00")),
    ).toEqual({
      enabled: true,
      time: "20:00",
      disabledReason: null,
      markTarget: null,
    });
  });

  it("marks tomorrow when turned on after today's time, and nothing before it", () => {
    expect(
      planScheduleSettingsChange(
        off,
        { scheduleDailyEnabled: true },
        jst("2026-11-02T21:00:00"),
      ).markTarget,
    ).toBe("2026-11-03");
    expect(
      planScheduleSettingsChange(
        off,
        { scheduleDailyEnabled: true },
        jst("2026-11-02T19:00:00"),
      ).markTarget,
    ).toBeNull();
  });

  it("marks only when the new time has already come today", () => {
    expect(
      planScheduleSettingsChange(
        on,
        { scheduleDailyTime: "08:00" },
        jst("2026-11-02T19:00:00"),
      ),
    ).toEqual({
      enabled: true,
      time: "08:00",
      disabledReason: null,
      markTarget: "2026-11-03",
    });
    expect(
      planScheduleSettingsChange(
        on,
        { scheduleDailyTime: "21:00" },
        jst("2026-11-02T19:00:00"),
      ).markTarget,
    ).toBeNull();
  });

  it("does not mark when an already-on setting is sent enabled: true", () => {
    expect(
      planScheduleSettingsChange(
        on,
        { scheduleDailyEnabled: true },
        jst("2026-11-02T21:00:00"),
      ),
    ).toEqual({
      enabled: true,
      time: "20:00",
      disabledReason: null,
      markTarget: null,
    });
  });

  it("does not mark when only the time changes while off", () => {
    expect(
      planScheduleSettingsChange(
        off,
        { scheduleDailyTime: "08:00" },
        jst("2026-11-02T19:00:00"),
      ),
    ).toEqual({
      enabled: false,
      time: "08:00",
      disabledReason: null,
      markTarget: null,
    });
  });

  it("turns off without marking and clears the auto-off reason", () => {
    expect(
      planScheduleSettingsChange(
        { ...on, disabledReason: UNREACHABLE_DISABLED_REASON },
        { scheduleDailyEnabled: false },
        jst("2026-11-02T21:00:00"),
      ),
    ).toEqual({
      enabled: false,
      time: "20:00",
      disabledReason: null,
      markTarget: null,
    });
  });

  it("clears the reason when turned back on after an auto-off", () => {
    expect(
      planScheduleSettingsChange(
        { ...off, disabledReason: UNREACHABLE_DISABLED_REASON },
        { scheduleDailyEnabled: true },
        jst("2026-11-02T21:00:00"),
      ),
    ).toEqual({
      enabled: true,
      time: "20:00",
      disabledReason: null,
      markTarget: "2026-11-03",
    });
  });

  it("marks across the year for a combined patch", () => {
    expect(
      planScheduleSettingsChange(
        off,
        { scheduleDailyEnabled: true, scheduleDailyTime: "21:00" },
        jst("2026-12-31T21:00:00"),
      ).markTarget,
    ).toBe("2027-01-01");
  });
});

describe("changedSections", () => {
  it("writes only the table the patch touches", () => {
    expect(changedSections({ techWeeklyDay: 3 })).toEqual({
      techWeekly: true,
      todoDaily: false,
      scheduleDaily: false,
    });
    expect(changedSections({ todoDailyTime: "09:00" })).toEqual({
      techWeekly: false,
      todoDaily: true,
      scheduleDaily: false,
    });
    expect(changedSections({ scheduleDailyEnabled: false })).toEqual({
      techWeekly: false,
      todoDaily: false,
      scheduleDaily: true,
    });
    expect(changedSections({})).toEqual({
      techWeekly: false,
      todoDaily: false,
      scheduleDaily: false,
    });
  });
});

describe("toNotificationSettings for schedules", () => {
  it("returns the default schedule settings without the processed target date", () => {
    const stored = { ...DEFAULT_SCHEDULE_DAILY, lastTargetDate: "2026-11-03" };
    const settings = toNotificationSettings(
      DEFAULT_NOTIFICATION_SETTINGS,
      0,
      0,
      stored,
    );
    expect(settings.scheduleDailyEnabled).toBe(true);
    expect(settings.scheduleDailyTime).toBe("20:00");
    expect(settings.scheduleDisabledReason).toBeNull();
    expect("lastTargetDate" in settings).toBe(false);
  });

  it("returns the auto-off reason and leaves tech and todo unchanged", () => {
    const settings = toNotificationSettings(
      DEFAULT_NOTIFICATION_SETTINGS,
      2,
      1,
      {
        enabled: false,
        time: "21:30",
        disabledReason: UNREACHABLE_DISABLED_REASON,
      },
    );
    expect(settings).toMatchObject({
      techWeeklyEnabled: true,
      techWeeklyTime: "20:00",
      pendingCount: 2,
      todoDailyTime: "08:00",
      todoPendingCount: 1,
      scheduleDailyEnabled: false,
      scheduleDailyTime: "21:30",
      scheduleDisabledReason: UNREACHABLE_DISABLED_REASON,
    });
  });
});
