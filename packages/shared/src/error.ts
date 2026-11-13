import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "group_not_found",
  "schedule_date_past",
  "not_schedulable",
  "memo_tag_not_changeable",
  "daily_report_not_found",
  "daily_report_memo_ineligible",
  "daily_report_too_long",
  "daily_report_exists",
  "daily_report_ai_limit",
  "daily_report_unavailable",
]);

export const apiErrorSchema = z.object({
  message: z.string(),
  // 知らない code は code 無しとして読む。
  code: apiErrorCodeSchema.optional().catch(undefined),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
