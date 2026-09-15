import { healthResponseSchema } from "@repo/shared";
import { Hono } from "hono";
import { auth } from "./auth";
import type { Env } from "./env";
import { lineWebhook } from "./line/webhook";
import { memoRoutes } from "./memos";
import { notificationRoutes } from "./notifications/routes";
import { scheduled } from "./notifications/scheduled";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json(healthResponseSchema.parse({ status: "ok" }));
});

app.route("/", auth);
app.route("/", lineWebhook);
app.route("/", memoRoutes);
app.route("/", notificationRoutes);

export default {
  fetch: app.fetch,
  scheduled,
};
