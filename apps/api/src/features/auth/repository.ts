import { eq } from "drizzle-orm";
import type { Database } from "../../db";
import { users } from "../../db/schema";

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
