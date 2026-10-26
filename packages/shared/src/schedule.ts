import { z } from "zod";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// 予定の日付（JST）。実在する日付だけを受け付ける。
export const scheduleDateSchema = z
  .string()
  .regex(DATE_PATTERN)
  .refine(isRealDate);

// 予定の時刻（JST）。無いときは「時間未定」。
export const scheduleTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const setScheduleRequestSchema = z.object({
  scheduledDate: scheduleDateSchema,
  scheduledTime: scheduleTimeSchema.nullable().optional(),
});

export type SetScheduleRequest = z.infer<typeof setScheduleRequestSchema>;
