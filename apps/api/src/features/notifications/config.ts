import type { DailySlot, WeeklySlot } from "./window";

// 通知の設定を環境変数の文字列から読む。空か無ければオフ、形が違えば invalid（オフとして扱う）。

export type SlotSetting<T> =
  | { state: "on"; slot: T }
  | { state: "off" }
  | { state: "invalid" };

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

// 「08:00」。
export function parseDailySetting(
  value: string | undefined,
): SlotSetting<DailySlot> {
  if (isBlank(value)) return { state: "off" };
  const time = (value ?? "").trim();
  return TIME.test(time)
    ? { state: "on", slot: { time } }
    : { state: "invalid" };
}

// 「sun 20:00」。曜日は英語の3文字（大文字小文字は問わない）。
export function parseWeeklySetting(
  value: string | undefined,
): SlotSetting<WeeklySlot> {
  if (isBlank(value)) return { state: "off" };
  const [day, time, ...rest] = (value ?? "").trim().split(/\s+/);
  const weekday = WEEKDAYS.indexOf(
    (day ?? "").toLowerCase() as (typeof WEEKDAYS)[number],
  );
  if (rest.length > 0 || weekday < 0 || !time || !TIME.test(time)) {
    return { state: "invalid" };
  }
  return { state: "on", slot: { weekday, time } };
}
