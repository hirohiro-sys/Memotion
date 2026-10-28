import { updateConnpassSettingsRequestSchema } from "@repo/shared";
import { Hono } from "hono";
import { createDb } from "../../db";
import type { Env } from "../../env";
import { readSessionUserId } from "../../lib/session";
import {
  getConnpassSettings,
  runManualSync,
  saveConnpassNickname,
} from "./service";

export const connpassRoutes = new Hono<{ Bindings: Env }>();

connpassRoutes.get("/api/connpass/settings", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }
  return c.json(await getConnpassSettings(createDb(c.env.DB), userId));
});

connpassRoutes.put("/api/connpass/settings", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  let body: ReturnType<typeof updateConnpassSettingsRequestSchema.parse>;
  try {
    body = updateConnpassSettingsRequestSchema.parse(await c.req.json());
  } catch {
    return c.json({ message: "invalid request" }, 400);
  }

  const result = await saveConnpassNickname(c.env, userId, body.nickname);
  if (result.status === "user_not_found") {
    return c.json(
      { message: "connpass user not found", code: "connpass_user_not_found" },
      400,
    );
  }
  if (result.status === "unavailable") {
    return c.json(
      { message: "connpass is unavailable", code: "connpass_unavailable" },
      502,
    );
  }
  return c.json(await getConnpassSettings(createDb(c.env.DB), userId));
});

connpassRoutes.post("/api/connpass/sync", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const result = await runManualSync(c.env, userId, new Date());
  if (result.status === "not_configured") {
    return c.json(
      {
        message: "connpass is not configured",
        code: "connpass_not_configured",
      },
      409,
    );
  }
  if (result.status === "too_soon") {
    return c.json(
      { message: "synced too recently", code: "connpass_sync_too_soon" },
      429,
    );
  }
  if (result.status === "success") {
    return c.json(result.summary);
  }
  return c.json(
    { message: "connpass is unavailable", code: "connpass_unavailable" },
    502,
  );
});
