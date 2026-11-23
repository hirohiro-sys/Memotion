import { z } from "zod";

export const apiErrorCodeSchema = z.enum(["schedule_date_past"]);

export const apiErrorSchema = z.object({
  message: z.string(),
  // 知らない code は code 無しとして読む。
  code: apiErrorCodeSchema.optional().catch(undefined),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
