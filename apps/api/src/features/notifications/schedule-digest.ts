import type { PushResult } from "../../lib/line/client";
import {
  type StoredScheduleSettings,
  UNREACHABLE_DISABLED_REASON,
} from "./settings";
import { isSameJstDayAsDue, scheduleTargetDate } from "./window";

export type ScheduleDigestDecision =
  | { action: "skip"; reason: "disabled" | "already" | "not_due" }
  // 日付をまたいだ。送らず、対象日を処理済みにする。
  | { action: "skip"; reason: "stale"; targetDate: string }
  | { action: "send"; targetDate: string };

// 予定の前日通知を送るかを、設定の行と now だけで決める（予定は読まない）。
// 順番: 無効 → 対象日を処理済み → 日付をまたいだ（未処理の行は待つ、処理済みの行は捨てる）→ 送る。
export function decideScheduleDigest(input: {
  settings: StoredScheduleSettings;
  now: Date;
}): ScheduleDigestDecision {
  const { settings, now } = input;
  if (!settings.enabled) return { action: "skip", reason: "disabled" };

  const slot = { time: settings.time };
  const targetDate = scheduleTargetDate(now, slot);
  if (
    settings.lastTargetDate !== null &&
    settings.lastTargetDate >= targetDate
  ) {
    return { action: "skip", reason: "already" };
  }
  if (!isSameJstDayAsDue(now, slot)) {
    return settings.lastTargetDate === null
      ? { action: "skip", reason: "not_due" }
      : { action: "skip", reason: "stale", targetDate };
  }
  return { action: "send", targetDate };
}

export type SchedulePushFollowUp =
  | { action: "none" }
  | { action: "revert"; lastTargetDate: string | null }
  | { action: "disable"; disabledReason: string };

// 送信結果からの後始末。一時的な失敗は先取りを元に戻して次の分に再試行する。
// 送れない状態はオフにし、先取りは戻さない。
export function afterSchedulePush(
  result: PushResult,
  previousLastTargetDate: string | null,
): SchedulePushFollowUp {
  if (result === "transient") {
    return { action: "revert", lastTargetDate: previousLastTargetDate };
  }
  if (result === "unreachable") {
    return { action: "disable", disabledReason: UNREACHABLE_DISABLED_REASON };
  }
  return { action: "none" };
}
