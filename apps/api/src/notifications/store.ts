import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Database } from "../db";
import { memos, tags, techWeeklySettings, users } from "../db/schema";
import type { DigestMemo } from "./message";
import type { StoredSettings } from "./settings";

export async function readStoredSettings(
  db: Database,
  userId: string,
): Promise<StoredSettings | null> {
  const [row] = await db
    .select({
      enabled: techWeeklySettings.enabled,
      weekday: techWeeklySettings.weekday,
      time: techWeeklySettings.time,
      lastSentAt: techWeeklySettings.lastSentAt,
      disabledReason: techWeeklySettings.disabledReason,
    })
    .from(techWeeklySettings)
    .where(eq(techWeeklySettings.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertSettings(
  db: Database,
  userId: string,
  settings: StoredSettings,
): Promise<void> {
  const [existing] = await db
    .select({ id: techWeeklySettings.id })
    .from(techWeeklySettings)
    .where(eq(techWeeklySettings.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(techWeeklySettings)
      .set({
        enabled: settings.enabled,
        weekday: settings.weekday,
        time: settings.time,
        lastSentAt: settings.lastSentAt,
        disabledReason: settings.disabledReason,
      })
      .where(eq(techWeeklySettings.userId, userId));
    return;
  }

  await db.insert(techWeeklySettings).values({
    id: nanoid(),
    userId,
    enabled: settings.enabled,
    weekday: settings.weekday,
    time: settings.time,
    lastSentAt: settings.lastSentAt,
    disabledReason: settings.disabledReason,
  });
}

export async function listAllowedUsers(
  db: Database,
): Promise<{ id: string; lineUserId: string }[]> {
  return db
    .select({ id: users.id, lineUserId: users.lineUserId })
    .from(users);
}

export async function listTechMemos(
  db: Database,
  userId: string,
): Promise<DigestMemo[]> {
  return db
    .select({
      createdAt: memos.createdAt,
      content: memos.content,
      mediaType: memos.mediaType,
      url: memos.url,
    })
    .from(memos)
    .innerJoin(tags, eq(memos.tagId, tags.id))
    .where(and(eq(memos.userId, userId), eq(tags.slug, "tech")));
}
