import { healthResponseSchema } from "@repo/shared";
import { Hono } from "hono";
import type { Env } from "./env";
import { auth } from "./features/auth";
import { lineWebhook } from "./features/line";
import { memoRoutes } from "./features/memos";
import { notificationRoutes } from "./features/notifications";
import { scheduled } from "./features/notifications/scheduled";

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
