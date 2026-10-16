import { z } from "zod";

export const memoTagSchema = z.enum(["tweet", "tech", "other", "todo"]);
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
});

export const memoListResponseSchema = z.object({
  items: z.array(memoSchema),
});

export const createMemoRequestSchema = z.object({
  // 端末が生成する冪等キー。旧版のクライアントのために任意にする。
  // 推測できる ID による先取りを防ぐため v4 に限る。
  id: z.uuidv4().optional(),
  tag: memoTagSchema,
  content: z.string().trim().min(1),
  // 端末でメモを書いた時刻。オフラインで書いたメモを書いた時刻で保存するため。
  createdAt: z.iso.datetime({ offset: true }).optional(),
});

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
