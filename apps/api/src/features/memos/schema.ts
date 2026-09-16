export {
  type CreateMemoRequest,
  createMemoRequestSchema,
  type Memo,
  type MemoListResponse,
  memoListResponseSchema,
  memoSchema,
} from "@repo/shared";

export type MemoRow = {
  id: string;
  tag: string;
  content: string;
  url: string | null;
  mediaType: string;
  source: string;
  createdAt: string;
};

export type PersistResult =
  | { status: "inserted" }
  | { status: "duplicate" }
  | { status: "failed"; reason: "save_failed" };
