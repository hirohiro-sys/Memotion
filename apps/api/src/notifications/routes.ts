import { updateNotificationSettingsRequestSchema } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { createDb, type Database } from "../db";
import { memos, tags, techWeeklySettings } from "../db/schema";
import type { Env } from "../env";
import { readSessionUserId } from "../session";
import {
  applySettingsPatch,
  DEFAULT_TECH_WEEKLY,
  type StoredSettings,
  toNotificationSettings,
} from "./settings";
import { isInstantInWindow, nextDigestWindow } from "./window";

export const notificationRoutes = new Hono<{ Bindings: Env }>();

function rowToStored(row: {
  enabled: boolean;
  weekday: number;
  time: string;
  lastSentAt: string | null;
  disabledReason: string | null;
}): StoredSettings {
  return {
    enabled: row.enabled,
    weekday: row.weekday,
    time: row.time,
    lastSentAt: row.lastSentAt,
    disabledReason: row.disabledReason,
  };
}

async function readStoredSettings(
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
  return row ? rowToStored(row) : null;
}

async function pendingCountFor(
  db: Database,
  userId: string,
  settings: StoredSettings,
  now: Date,
): Promise<number> {
  const window = nextDigestWindow(
    now,
    { weekday: settings.weekday, time: settings.time },
    settings.lastSentAt,
  );
  const rows = await db
    .select({ createdAt: memos.createdAt })
    .from(memos)
    .innerJoin(tags, eq(memos.tagId, tags.id))
    .where(and(eq(memos.userId, userId), eq(tags.slug, "tech")));
  return rows.filter((row) => isInstantInWindow(row.createdAt, window)).length;
}

async function upsertSettings(
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

notificationRoutes.get("/api/notifications", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const settings = (await readStoredSettings(db, userId)) ?? DEFAULT_TECH_WEEKLY;
  const pendingCount = await pendingCountFor(db, userId, settings, now);
  return c.json(toNotificationSettings(settings, pendingCount));
});

notificationRoutes.patch("/api/notifications", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  let patch: ReturnType<typeof updateNotificationSettingsRequestSchema.parse>;
  try {
    patch = updateNotificationSettingsRequestSchema.parse(await c.req.json());
  } catch {
    return c.json({ message: "invalid request" }, 400);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const current = await readStoredSettings(db, userId);
  const next = applySettingsPatch(current, patch, now);
  await upsertSettings(db, userId, next);
  const pendingCount = await pendingCountFor(db, userId, next, now);
  return c.json(toNotificationSettings(next, pendingCount));
});
