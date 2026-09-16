import { Hono } from "hono";
import { createDb } from "../../db";
import type { Env } from "../../env";
import { readSessionUserId } from "../../lib/session";
import { createMemoRequestSchema } from "./schema";
import {
  createForUser,
  deleteForUser,
  getImageForUser,
  listForUser,
} from "./service";

export const memoRoutes = new Hono<{ Bindings: Env }>();

export { toMemoResponse } from "./service";

memoRoutes.get("/api/memos", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  return c.json(await listForUser(createDb(c.env.DB), userId));
});

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

  const result = await createForUser(createDb(c.env.DB), userId, body);
  if (!result.ok) {
    return c.json(
      {
        message: result.error === "invalid" ? "invalid request" : "save failed",
      },
      result.error === "invalid" ? 400 : 500,
    );
  }

  return c.json(result.memo, 201);
});

memoRoutes.get("/api/memos/:id/image", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const object = await getImageForUser(c.env, userId, c.req.param("id"));
  if (!object) {
    return c.json({ message: "not found" }, 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
    },
  });
});

memoRoutes.delete("/api/memos/:id", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const result = await deleteForUser(c.env, userId, c.req.param("id"));
  if (result === "not_found") {
    return c.json({ message: "not found" }, 404);
  }

  return c.body(null, 204);
});
