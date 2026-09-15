import { updateNotificationSettingsRequestSchema } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../db";
import { memos, tags } from "../db/schema";
import type { Env } from "../env";
import { readSessionUserId } from "../session";
import {
  applySettingsPatch,
  DEFAULT_TECH_WEEKLY,
  type StoredSettings,
  toNotificationSettings,
} from "./settings";
import { readStoredSettings, upsertSettings } from "./store";
import { isInstantInWindow, nextDigestWindow } from "./window";

export const notificationRoutes = new Hono<{ Bindings: Env }>();

async function pendingCountFor(
  db: ReturnType<typeof createDb>,
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

notificationRoutes.get("/api/notifications", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const db = createDb(c.env.DB);
  const now = new Date();
  const settings =
    (await readStoredSettings(db, userId)) ?? DEFAULT_TECH_WEEKLY;
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
