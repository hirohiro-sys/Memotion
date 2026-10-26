import type { MemoTag } from "@repo/shared";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// now の JST の日付（YYYY-MM-DD）。
export function jstDateOf(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// 予定の日付が JST の今日より前か。今日の日付は過去でない（時刻は見ない）。
export function isPastScheduleDate(date: string, now: Date): boolean {
  return date < jstDateOf(now);
}

export type ScheduleSetDecision = "ok" | "not_found" | "not_schedulable";

// 「予定にする」と「日時を変更」ができるのは、グループに入っていない tweet か schedule のメモだけ。
export function decideScheduleSet(input: {
  memo: { tag: string; groupId: string | null } | null;
}): ScheduleSetDecision {
  const { memo } = input;
  if (!memo) return "not_found";
  if (memo.groupId !== null) return "not_schedulable";
  return memo.tag === "tweet" || memo.tag === "schedule"
    ? "ok"
    : "not_schedulable";
}

export type CreateScheduleDecision = "ok" | "invalid" | "past_date";

// 作成の検査。グループに入った予定は作らせない。過去の日付は DB に触る前に弾く。
export function validateCreateSchedule(
  input: { tag: MemoTag; groupId?: string; scheduledDate?: string },
  now: Date,
): CreateScheduleDecision {
  if (input.tag !== "schedule") return "ok";
  if (input.groupId !== undefined) return "invalid";
  if (
    input.scheduledDate !== undefined &&
    isPastScheduleDate(input.scheduledDate, now)
  ) {
    return "past_date";
  }
  return "ok";
}
