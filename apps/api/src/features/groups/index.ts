import {
  assignMemosRequestSchema,
  assignMemosResponseSchema,
  createGroupMemoRequestSchema,
  createGroupRequestSchema,
  deleteGroupResponseSchema,
  groupIdSchema,
  renameGroupRequestSchema,
} from "@repo/shared";
import { type Context, Hono } from "hono";
import { createDb } from "../../db";
import type { Env } from "../../env";
import { readSessionUserId } from "../../lib/session";
import { captureOgpForMemo } from "../memos/service";
import {
  assignMemosForUser,
  createForUser,
  createMemoForUser,
  deleteForUser,
  listForUser,
  listMemosForUser,
  renameForUser,
} from "./service";

export const groupRoutes = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;

function groupNotFound(c: AppContext) {
  return c.json({ message: "group not found", code: "group_not_found" }, 404);
}

function invalidRequest(c: AppContext) {
  return c.json({ message: "invalid request" }, 400);
}

function parseGroupId(c: AppContext): string | null {
  const parsed = groupIdSchema.safeParse(c.req.param("id"));
  return parsed.success ? parsed.data : null;
}

// API は zod を直接の依存に持たないため、safeParse を持つものとして受け取る。
type BodySchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

async function parseBody<T>(
  c: AppContext,
  schema: BodySchema<T>,
): Promise<T | null> {
  try {
    const parsed = schema.safeParse(await c.req.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

groupRoutes.get("/api/groups", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  return c.json(await listForUser(createDb(c.env.DB), userId));
});

groupRoutes.post("/api/groups", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const body = await parseBody(c, createGroupRequestSchema);
  if (!body) return invalidRequest(c);

  const result = await createForUser(createDb(c.env.DB), userId, body.name);
  if (!result.ok) {
    if (result.error === "duplicate") {
      return c.json({ message: "duplicate name" }, 409);
    }
    return c.json({ message: "save failed" }, 500);
  }
  return c.json(result.group, 201);
});

groupRoutes.patch("/api/groups/:id", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const groupId = parseGroupId(c);
  const body = await parseBody(c, renameGroupRequestSchema);
  if (!groupId || !body) return invalidRequest(c);

  const result = await renameForUser(
    createDb(c.env.DB),
    userId,
    groupId,
    body.name,
  );
  if (!result.ok) {
    if (result.error === "not_found") return groupNotFound(c);
    if (result.error === "duplicate") {
      return c.json({ message: "duplicate name" }, 409);
    }
    return c.json({ message: "save failed" }, 500);
  }
  return c.json(result.group);
});

groupRoutes.delete("/api/groups/:id", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const groupId = parseGroupId(c);
  if (!groupId) return invalidRequest(c);

  const result = await deleteForUser(c.env, userId, groupId);
  if (!result.ok) {
    if (result.error === "not_found") return groupNotFound(c);
    return c.json({ message: "delete failed" }, 500);
  }
  return c.json(
    deleteGroupResponseSchema.parse({ deletedMemos: result.deletedMemos }),
  );
});

groupRoutes.get("/api/groups/:id/memos", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const groupId = parseGroupId(c);
  if (!groupId) return invalidRequest(c);

  const list = await listMemosForUser(createDb(c.env.DB), userId, groupId);
  if (!list) return groupNotFound(c);
  return c.json(list);
});

groupRoutes.post("/api/groups/:id/memos", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const groupId = parseGroupId(c);
  const body = await parseBody(c, createGroupMemoRequestSchema);
  if (!groupId || !body) return invalidRequest(c);

  const result = await createMemoForUser(
    createDb(c.env.DB),
    userId,
    groupId,
    body,
  );
  if (!result.ok) {
    if (result.error === "group_missing") return groupNotFound(c);
    if (result.error === "invalid") return invalidRequest(c);
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

groupRoutes.post("/api/groups/:id/memos/assign", async (c) => {
  const userId = await readSessionUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }

  const groupId = parseGroupId(c);
  const body = await parseBody(c, assignMemosRequestSchema);
  if (!groupId || !body) return invalidRequest(c);

  const result = await assignMemosForUser(
    createDb(c.env.DB),
    userId,
    groupId,
    body.ids,
  );
  if (!result.ok) return groupNotFound(c);
  return c.json(
    assignMemosResponseSchema.parse({
      added: result.added,
      skippedTodo: result.skippedTodo,
      skippedSchedule: result.skippedSchedule,
    }),
  );
});
