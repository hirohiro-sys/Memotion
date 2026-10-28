import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "group_not_found",
  "schedule_date_past",
  "not_schedulable",
  "connpass_user_not_found",
  "connpass_not_configured",
  "connpass_sync_too_soon",
  "connpass_unavailable",
]);

export const apiErrorSchema = z.object({
  message: z.string(),
  // 知らない code は code 無しとして読む。
  code: apiErrorCodeSchema.optional().catch(undefined),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
