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
  tag: memoTagSchema,
  content: z.string().trim().min(1),
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
