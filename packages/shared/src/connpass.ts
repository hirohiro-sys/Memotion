import { z } from "zod";

// connpass のユーザー名（ニックネーム）。URL の https://connpass.com/user/xxx/ の xxx。
export const connpassNicknameSchema = z.string().regex(/^[A-Za-z0-9_-]{1,50}$/);

export const connpassSyncStatusSchema = z.enum(["success", "failed"]);

export const connpassSettingsSchema = z.object({
  nickname: connpassNicknameSchema.nullable(),
  lastSyncedAt: z.string().nullable(),
  lastSyncStatus: connpassSyncStatusSchema.nullable(),
});

// null でユーザー名を消し、取り込みを止める。
export const updateConnpassSettingsRequestSchema = z.object({
  nickname: connpassNicknameSchema.nullable(),
});

export const connpassSyncResponseSchema = z.object({
  created: z.number().int().min(0),
  updated: z.number().int().min(0),
  deleted: z.number().int().min(0),
  // 全ページを最後まで取れたか。false のときは削除を行っていない。
  complete: z.boolean(),
});

export type ConnpassSettings = z.infer<typeof connpassSettingsSchema>;
export type UpdateConnpassSettingsRequest = z.infer<
  typeof updateConnpassSettingsRequestSchema
>;
export type ConnpassSyncResponse = z.infer<typeof connpassSyncResponseSchema>;
