import { z } from "zod";
import { scheduleDateSchema, scheduleTimeSchema } from "./schedule";

export const memoTagSchema = z.enum([
  "tweet",
  "tech",
  "other",
  "todo",
  "schedule",
]);
export const memoIdSchema = z.string().min(1).max(64);
export const memoMediaTypeSchema = z.enum(["text", "url", "image"]);
export const memoSourceSchema = z.enum(["line", "web"]);

export const memoSchema = z.object({
  id: z.string(),
  tag: memoTagSchema,
  content: z.string(),
  url: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  mediaType: memoMediaTypeSchema,
  createdAt: z.string(),
  source: memoSourceSchema,
  // 予定（tag: schedule）のときだけ入る。時刻が無い予定は「時間未定」。
  scheduledDate: scheduleDateSchema.optional(),
  scheduledTime: scheduleTimeSchema.optional(),
});

export const memoListResponseSchema = z.object({
  items: z.array(memoSchema),
});

// 検査（superRefine）を持つスキーマは .extend() できないため、土台を分けて持つ。
// グループの入力欄は、この土台から日時を除いて作る。
export const createMemoRequestBaseSchema = z.object({
  // 端末が生成する冪等キー。旧版のクライアントのために任意にする。
  // 推測できる ID による先取りを防ぐため v4 に限る。
  id: z.uuidv4().optional(),
  tag: memoTagSchema,
  content: z.string().trim().min(1),
  // 端末でメモを書いた時刻。オフラインで書いたメモを書いた時刻で保存するため。
  createdAt: z.iso.datetime({ offset: true }).optional(),
  scheduledDate: scheduleDateSchema.optional(),
  scheduledTime: scheduleTimeSchema.nullable().optional(),
});

// 予定は日付が必須。ほかのタグは日時を持たない。日付なしの時刻は、どのタグでも不可。
export const createMemoRequestSchema = createMemoRequestBaseSchema.superRefine(
  (value, ctx) => {
    const hasDate = value.scheduledDate !== undefined;
    const hasTime =
      value.scheduledTime !== undefined && value.scheduledTime !== null;
    if (value.tag === "schedule" && !hasDate) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledDate"],
        message: "schedule requires scheduledDate",
      });
    }
    if (value.tag !== "schedule" && (hasDate || hasTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledDate"],
        message: "only schedule can have a date",
      });
    }
    if (!hasDate && hasTime) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledTime"],
        message: "scheduledTime requires scheduledDate",
      });
    }
  },
);

export const MAX_BULK_DELETE = 500;

export const deleteMemosRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_BULK_DELETE),
});

export const deleteMemosResponseSchema = z.object({
  deleted: z.number().int().nonnegative(),
});

export type MemoTag = z.infer<typeof memoTagSchema>;
export type MemoMediaType = z.infer<typeof memoMediaTypeSchema>;
export type MemoSource = z.infer<typeof memoSourceSchema>;
export type Memo = z.infer<typeof memoSchema>;
export type MemoListResponse = z.infer<typeof memoListResponseSchema>;
export type CreateMemoRequest = z.infer<typeof createMemoRequestSchema>;
export type DeleteMemosRequest = z.infer<typeof deleteMemosRequestSchema>;
export type DeleteMemosResponse = z.infer<typeof deleteMemosResponseSchema>;
