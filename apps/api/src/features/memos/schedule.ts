import type { MemoTag } from "@repo/shared";
import { jstDateString } from "../../lib/jst";

// 予定の日付が JST の今日より前か。今日の日付は過去でない（時刻は見ない）。
export function isPastScheduleDate(date: string, now: Date): boolean {
  return date < jstDateString(now);
}

export type CreateScheduleDecision = "ok" | "past_date";

// 作成の検査。過去の日付は Notion に触る前に弾く。予定以外は日付を見ない。
export function validateCreateSchedule(
  input: { tag: MemoTag; scheduledDate?: string },
  now: Date,
): CreateScheduleDecision {
  if (input.tag !== "schedule" || input.scheduledDate === undefined) {
    return "ok";
  }
  return isPastScheduleDate(input.scheduledDate, now) ? "past_date" : "ok";
}
