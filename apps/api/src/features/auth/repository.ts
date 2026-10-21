import { eq } from "drizzle-orm";
import type { Database } from "../../db";
import { users } from "../../db/schema";

// LINE のユーザー ID（U + 32桁）とは重ならない固定値。ローカル D1 にだけ置く。
export const DEV_USER_ID = "usr_dev_local";
export const DEV_LINE_USER_ID = "dev-local";

export async function findUserIdByLineUserId(
  db: Database,
  lineUserId: string,
): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.lineUserId, lineUserId))
    .limit(1);
  return user?.id ?? null;
}

export async function ensureDevUser(
  db: Database,
  createdAt: string,
): Promise<string> {
  const existing = await findUserIdByLineUserId(db, DEV_LINE_USER_ID);
  if (existing) return existing;
  try {
    await db.insert(users).values({
      id: DEV_USER_ID,
      lineUserId: DEV_LINE_USER_ID,
      createdAt,
    });
  } catch {
    const raced = await findUserIdByLineUserId(db, DEV_LINE_USER_ID);
    if (raced) return raced;
    throw new Error("dev user was not created");
  }
  return DEV_USER_ID;
}
