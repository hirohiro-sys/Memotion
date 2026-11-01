import { z } from "zod";
import { memoIdSchema } from "./memo";
import { scheduleDateSchema } from "./schedule";

// D1 のバインド変数上限に合わせる。メモの一括削除（500）とは別の上限。
export const MAX_DAILY_REPORT_MEMOS = 90;
export const MAX_DAILY_REPORT_BODY = 20_000;
export const DAILY_REPORT_GENERATION_LIMIT = 2;

export const dailyReportKindSchema = z.enum(["work", "personal"]);
export const dailyReportFrameworkSchema = z.enum(["log", "achievement"]);
export const dailyReportStatusSchema = z.enum(["draft", "confirmed"]);
export const dailyReportIdSchema = z.string().min(1).max(64);

export const dailyReportBodySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DAILY_REPORT_BODY);

export const dailyReportMemoIdsSchema = z
  .array(memoIdSchema)
  .min(1)
  .max(MAX_DAILY_REPORT_MEMOS)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "duplicate memo id",
  });

export const dailyReportSummarySchema = z.object({
  id: dailyReportIdSchema,
  reportDate: scheduleDateSchema,
  kind: dailyReportKindSchema,
  framework: dailyReportFrameworkSchema,
  status: dailyReportStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const dailyReportListResponseSchema = z.object({
  reports: z.array(dailyReportSummarySchema),
  remainingGenerations: z
    .number()
    .int()
    .min(0)
    .max(DAILY_REPORT_GENERATION_LIMIT),
});

// 紐づくメモが全部消えると memoIds は空になる。
export const dailyReportSchema = dailyReportSummarySchema.extend({
  body: dailyReportBodySchema,
  memoIds: z.array(memoIdSchema),
});

export const createDailyReportRequestSchema = z.object({
  reportDate: scheduleDateSchema,
  kind: dailyReportKindSchema,
  framework: dailyReportFrameworkSchema,
  memoIds: dailyReportMemoIdsSchema,
});

export const appendDailyReportRequestSchema = z.object({
  framework: dailyReportFrameworkSchema,
  memoIds: dailyReportMemoIdsSchema,
});

export const updateDailyReportRequestSchema = z.object({
  body: dailyReportBodySchema,
  status: dailyReportStatusSchema,
  framework: dailyReportFrameworkSchema,
});

export const deleteDailyReportResponseSchema = z.object({
  deleted: z.literal(true),
});

// 409 だけ dailyReportId を返す。汎用の apiErrorSchema には載せない。
export const dailyReportExistsErrorSchema = z.object({
  message: z.string(),
  code: z.literal("daily_report_exists"),
  dailyReportId: dailyReportIdSchema,
});

export type DailyReportKind = z.infer<typeof dailyReportKindSchema>;
export type DailyReportFramework = z.infer<typeof dailyReportFrameworkSchema>;
export type DailyReportStatus = z.infer<typeof dailyReportStatusSchema>;
export type DailyReportSummary = z.infer<typeof dailyReportSummarySchema>;
export type DailyReportListResponse = z.infer<
  typeof dailyReportListResponseSchema
>;
export type DailyReport = z.infer<typeof dailyReportSchema>;
export type CreateDailyReportRequest = z.infer<
  typeof createDailyReportRequestSchema
>;
export type AppendDailyReportRequest = z.infer<
  typeof appendDailyReportRequestSchema
>;
export type UpdateDailyReportRequest = z.infer<
  typeof updateDailyReportRequestSchema
>;
export type DeleteDailyReportResponse = z.infer<
  typeof deleteDailyReportResponseSchema
>;
export type DailyReportExistsError = z.infer<
  typeof dailyReportExistsErrorSchema
>;
