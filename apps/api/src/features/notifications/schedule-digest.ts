import type { PushResult } from "../../lib/line/client";
import {
  type DailySlot,
  isSameJstDayAsDue,
  scheduleTargetDate,
} from "./window";

export type ScheduleDigestDecision =
  // 記録が無い（初回）。送らず、今の対象日を処理済みにする。
  | { action: "baseline"; targetDate: string }
  | { action: "skip"; reason: "already" }
  // 日付をまたいだ。送らず、対象日を処理済みにする。
  | { action: "skip"; reason: "stale"; targetDate: string }
  | { action: "send"; targetDate: string };

// 予定の前日通知を送るかを、設定と最後に処理した対象日と now だけで決める（予定は読まない）。
// 順番: 記録なし → 対象日を処理済み → 日付をまたいだ → 送る。
export function decideScheduleDigest(input: {
  slot: DailySlot;
  lastTargetDate: string | null;
  now: Date;
}): ScheduleDigestDecision {
  const { slot, lastTargetDate, now } = input;
  const targetDate = scheduleTargetDate(now, slot);
  if (lastTargetDate === null) return { action: "baseline", targetDate };
  if (lastTargetDate >= targetDate)
    return { action: "skip", reason: "already" };
  if (!isSameJstDayAsDue(now, slot)) {
    return { action: "skip", reason: "stale", targetDate };
  }
  return { action: "send", targetDate };
}

export type SchedulePushFollowUp =
  | { action: "none" }
  | { action: "revert"; lastTargetDate: string | null };

// 送信結果からの後始末。一時的な失敗は先取りを元に戻して次の分に再試行する。
// 届かない（ブロックなど）ときは先取りを戻さない（毎分送り直さない）。
export function afterSchedulePush(
  result: PushResult,
  previousLastTargetDate: string | null,
): SchedulePushFollowUp {
  if (result === "transient") {
    return { action: "revert", lastTargetDate: previousLastTargetDate };
  }
  return { action: "none" };
}
