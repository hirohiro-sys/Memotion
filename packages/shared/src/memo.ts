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

export type MemoTag = z.infer<typeof memoTagSchema>;
export type MemoMediaType = z.infer<typeof memoMediaTypeSchema>;
export type MemoSource = z.infer<typeof memoSourceSchema>;
export type Memo = z.infer<typeof memoSchema>;
export type MemoListResponse = z.infer<typeof memoListResponseSchema>;
export type CreateMemoRequest = z.infer<typeof createMemoRequestSchema>;
