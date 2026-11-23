import { healthResponseSchema } from "@repo/shared";
import { Hono } from "hono";
import type { Env } from "./env";
import { auth } from "./features/auth";
import { dailyReportRoutes } from "./features/daily-reports";
import { groupRoutes } from "./features/groups";
import { lineWebhook } from "./features/line";
import { memoRoutes } from "./features/memos";
import { scheduled } from "./features/notifications/scheduled";

// wrangler.toml の Durable Object は、入口のモジュールから export する。
export { NotifySentState } from "./features/notifications/sent-state";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json(healthResponseSchema.parse({ status: "ok" }));
});

app.route("/", auth);
app.route("/", dailyReportRoutes);
app.route("/", groupRoutes);
app.route("/", lineWebhook);
app.route("/", memoRoutes);

export default {
  fetch: app.fetch,
  scheduled,
};
