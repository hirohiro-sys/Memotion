import { z } from "zod";
import {
  createMemoRequestBaseSchema,
  MAX_BULK_DELETE,
  memoTagSchema,
} from "./memo";

export const groupIdSchema = z.string().min(1).max(64);

const groupNameSchema = z.string().trim().min(1).max(50);

export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  memoCount: z.number().int().nonnegative(),
  lastAddedAt: z.string(),
  createdAt: z.string(),
});

export const groupListResponseSchema = z.object({
  items: z.array(groupSchema),
});

export const createGroupRequestSchema = z.object({
  name: groupNameSchema,
});

export const renameGroupRequestSchema = z.object({
  name: groupNameSchema,
});

export const assignMemosRequestSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(MAX_BULK_DELETE),
});

export const assignMemosResponseSchema = z.object({
  added: z.number().int().nonnegative(),
  skippedTodo: z.number().int().nonnegative(),
  skippedSchedule: z.number().int().nonnegative(),
});

export const deleteGroupResponseSchema = z.object({
  deletedMemos: z.number().int().nonnegative(),
});

// todo と schedule はグループに入れられない。
export const groupMemoTagSchema = memoTagSchema.exclude(["todo", "schedule"]);

// グループの入力欄は日時を受け取らない（送られても捨てる）。
export const createGroupMemoRequestSchema = createMemoRequestBaseSchema
  .omit({ scheduledDate: true, scheduledTime: true })
  .extend({ tag: groupMemoTagSchema });

export type Group = z.infer<typeof groupSchema>;
export type GroupListResponse = z.infer<typeof groupListResponseSchema>;
export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;
export type RenameGroupRequest = z.infer<typeof renameGroupRequestSchema>;
export type AssignMemosRequest = z.infer<typeof assignMemosRequestSchema>;
export type AssignMemosResponse = z.infer<typeof assignMemosResponseSchema>;
export type DeleteGroupResponse = z.infer<typeof deleteGroupResponseSchema>;
export type GroupMemoTag = z.infer<typeof groupMemoTagSchema>;
export type CreateGroupMemoRequest = z.infer<
  typeof createGroupMemoRequestSchema
>;
