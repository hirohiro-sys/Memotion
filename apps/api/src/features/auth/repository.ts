import type { Database } from "../../db";
import { users } from "../../db/schema";

// LINE のユーザー ID（U + 32桁）とは重ならない固定値。ローカル D1 にだけ置く。
// D1 のメモの外部キーを満たすためだけの行で、#143 で D1 を外すときに消す。
export const DEV_USER_ID = "usr_dev_local";
export const DEV_LINE_USER_ID = "dev-local";

export async function ensureDevUser(
  db: Database,
  createdAt: string,
): Promise<string> {
  await db
    .insert(users)
    .values({ id: DEV_USER_ID, lineUserId: DEV_LINE_USER_ID, createdAt })
    .onConflictDoNothing();
  return DEV_USER_ID;
}
