import { updateNotificationSettingsRequestSchema } from "@repo/shared";
import { Hono } from "hono";
import { createDb } from "../../db";
import type { Env } from "../../env";
import { readSessionUserId } from "../../lib/session";
import { getNotificationSettings, updateNotificationSettings } from "./service";

export const notificationRoutes = new Hono<{ Bindings: Env }>();

notificationRoutes.get("/api/notifications", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  return c.json(
    await getNotificationSettings(createDb(c.env.DB), userId, new Date()),
  );
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

  return c.json(
    await updateNotificationSettings(
      createDb(c.env.DB),
      userId,
      patch,
      new Date(),
    ),
  );
});
