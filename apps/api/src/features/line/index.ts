import { Hono } from "hono";
import type { Env } from "../../env";
import { verifyLineSignature } from "../../lib/line/signature";
import { processWebhook } from "./service";

export const lineWebhook = new Hono<{ Bindings: Env }>();

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

lineWebhook.post("/api/line/webhook", async (c) => {
  const rawBody = await c.req.arrayBuffer();
  const valid = await verifyLineSignature(
    rawBody,
    c.req.header("x-line-signature"),
    c.env.LINE_MESSAGING_CHANNEL_SECRET,
  );
  if (!valid) {
    logJson({ event: "line.webhook", status: "invalid_signature" });
    return c.body(null, 400);
  }

  c.executionCtx.waitUntil(processWebhook(c.env, rawBody));
  return c.body(null, 200);
});
