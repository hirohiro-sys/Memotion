import { createMemoRequestSchema } from "@repo/shared";
import { Hono } from "hono";
import type { Env } from "../../env";
import { readSessionUserId } from "../../lib/session";
import { createForUser } from "./service";

export const memoRoutes = new Hono<{ Bindings: Env }>();

memoRoutes.post("/api/memos", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  let body: ReturnType<typeof createMemoRequestSchema.parse>;
  try {
    body = createMemoRequestSchema.parse(await c.req.json());
  } catch {
    return c.json({ message: "invalid request" }, 400);
  }

  const result = await createForUser(c.env, userId, body);
  if (!result.ok) {
    if (result.error === "past_date") {
      return c.json(
        { message: "schedule date is past", code: "schedule_date_past" },
        400,
      );
    }
    if (result.error === "conflict") {
      return c.json({ message: "conflict" }, 409);
    }
    // 保存先の Notion に書けなかった。端末は未送信に残して送り直す。
    return c.json({ message: "save failed" }, 502);
  }

  return c.json(result.memo, result.created ? 201 : 200);
});
