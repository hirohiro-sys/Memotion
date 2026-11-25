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

export type ScheduleFields = { scheduledDate?: string; scheduledTime?: string };

// メモが持つ予定の日時。予定のときだけ日付を持ち、時刻は日付があるときだけ持つ。
// 無いキーは付けない（null や空文字も無いとみなす）。
export function scheduleFields(memo: {
  tag: MemoTag;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
}): ScheduleFields {
  if (memo.tag !== "schedule" || !memo.scheduledDate) return {};
  return memo.scheduledTime
    ? { scheduledDate: memo.scheduledDate, scheduledTime: memo.scheduledTime }
    : { scheduledDate: memo.scheduledDate };
}
