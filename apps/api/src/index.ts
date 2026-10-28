import { healthResponseSchema } from "@repo/shared";
import { Hono } from "hono";
import type { Env } from "./env";
import { auth } from "./features/auth";
import { connpassRoutes } from "./features/connpass";
import { groupRoutes } from "./features/groups";
import { lineWebhook } from "./features/line";
import { memoRoutes } from "./features/memos";
import { notificationRoutes } from "./features/notifications";
import { scheduled } from "./scheduled";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json(healthResponseSchema.parse({ status: "ok" }));
});

app.route("/", auth);
app.route("/", connpassRoutes);
app.route("/", groupRoutes);
app.route("/", lineWebhook);
app.route("/", memoRoutes);
app.route("/", notificationRoutes);

export default {
  fetch: app.fetch,
  scheduled,
};
