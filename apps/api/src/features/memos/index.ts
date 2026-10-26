import {
  createMemoRequestSchema,
  deleteMemosRequestSchema,
  deleteMemosResponseSchema,
  memoIdSchema,
  setScheduleRequestSchema,
} from "@repo/shared";
import { Hono } from "hono";
import { createDb } from "../../db";
import type { Env } from "../../env";
import { readSessionUserId } from "../../lib/session";
import {
  backfillOgpForUser,
  captureOgpForMemo,
  createForUser,
  deleteManyForUser,
  getImageForUser,
  listForUser,
  setScheduleForUser,
} from "./service";

export const memoRoutes = new Hono<{ Bindings: Env }>();

export { toMemoResponse } from "./service";

memoRoutes.get("/api/memos", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const list = await listForUser(createDb(c.env.DB), userId);
  c.executionCtx.waitUntil(backfillOgpForUser(c.env, userId));
  return c.json(list);
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
    if (result.error === "invalid") {
      return c.json({ message: "invalid request" }, 400);
    }
    if (result.error === "past_date") {
      return c.json(
        { message: "schedule date is past", code: "schedule_date_past" },
        400,
      );
    }
    if (result.error === "conflict") {
      return c.json({ message: "conflict" }, 409);
    }
    return c.json({ message: "save failed" }, 500);
  }

  if (!result.created) {
    return c.json(result.memo, 200);
  }
  if (result.memo.mediaType === "url") {
    c.executionCtx.waitUntil(captureOgpForMemo(c.env, result.memo.id));
  }
  return c.json(result.memo, 201);
});

memoRoutes.put("/api/memos/:id/schedule", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const memoId = memoIdSchema.safeParse(c.req.param("id"));
  let body: ReturnType<typeof setScheduleRequestSchema.parse>;
  try {
    body = setScheduleRequestSchema.parse(await c.req.json());
  } catch {
    return c.json({ message: "invalid request" }, 400);
  }
  if (!memoId.success) {
    return c.json({ message: "invalid request" }, 400);
  }

  const result = await setScheduleForUser(
    createDb(c.env.DB),
    userId,
    memoId.data,
    body,
  );
  if (!result.ok) {
    if (result.error === "past_date") {
      return c.json(
        { message: "schedule date is past", code: "schedule_date_past" },
        400,
      );
    }
    if (result.error === "not_found") {
      return c.json({ message: "not found" }, 404);
    }
    if (result.error === "not_schedulable") {
      return c.json(
        { message: "not schedulable", code: "not_schedulable" },
        409,
      );
    }
    return c.json({ message: "save failed" }, 500);
  }
  return c.json(result.memo);
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

memoRoutes.post("/api/memos/bulk-delete", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  let body: ReturnType<typeof deleteMemosRequestSchema.parse>;
  try {
    body = deleteMemosRequestSchema.parse(await c.req.json());
  } catch {
    return c.json({ message: "invalid request" }, 400);
  }

  const result = await deleteManyForUser(c.env, userId, body.ids);
  return c.json(deleteMemosResponseSchema.parse(result));
});
