import type { Memo } from "@repo/shared";
import { isScheduleMemo } from "./day-schedule";
import { formatScheduleDate } from "./jst";

export type ScheduleCardLine = {
  readonly dateLabel: string;
  readonly timeLabel: string;
};

const UNTIMED_LABEL = "時間未定";

export function scheduleCardLine(
  memo: Pick<Memo, "tag" | "scheduledDate" | "scheduledTime">,
): ScheduleCardLine | null {
  if (!isScheduleMemo(memo)) return null;
  return {
    dateLabel: formatScheduleDate(memo.scheduledDate),
    timeLabel: memo.scheduledTime ?? UNTIMED_LABEL,
  };
}
