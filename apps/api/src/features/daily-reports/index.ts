import {
  type AppendDailyReportRequest,
  appendDailyReportRequestSchema,
  type CreateDailyReportRequest,
  createDailyReportRequestSchema,
  dailyReportIdSchema,
  dailyReportSchema,
  deleteDailyReportResponseSchema,
  type UpdateDailyReportRequest,
  updateDailyReportRequestSchema,
} from "@repo/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { createDb } from "../../db";
import type { Env } from "../../env";
import { readSessionUserId } from "../../lib/session";
import {
  appendForUser,
  createForUser,
  deleteForUser,
  getForUser,
  listForUser,
  updateForUser,
} from "./service";

export const dailyReportRoutes = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;

type Failure =
  | { ok: false; error: "not_found" }
  | { ok: false; error: "memo_not_found" }
  | { ok: false; error: "ineligible" }
  | { ok: false; error: "exists"; dailyReportId: string }
  | { ok: false; error: "invalid" }
  | { ok: false; error: "unavailable" }
  | { ok: false; error: "limit" }
  | { ok: false; error: "too_long" };

function invalid(c: AppContext) {
  return c.json({ message: "invalid request" }, 400);
}

function failure(c: AppContext, result: Failure) {
  switch (result.error) {
    case "not_found":
      return c.json(
        { message: "daily report not found", code: "daily_report_not_found" },
        404,
      );
    case "memo_not_found":
      return c.json({ message: "memo not found" }, 404);
    case "ineligible":
      return c.json(
        {
          message: "memo is ineligible",
          code: "daily_report_memo_ineligible",
        },
        400,
      );
    case "exists":
      return c.json(
        {
          message: "daily report exists",
          code: "daily_report_exists",
          dailyReportId: result.dailyReportId,
        },
        409,
      );
    case "invalid":
      return invalid(c);
    case "unavailable":
      return c.json(
        {
          message: "daily report unavailable",
          code: "daily_report_unavailable",
        },
        502,
      );
    case "limit":
      return c.json(
        { message: "daily report ai limit", code: "daily_report_ai_limit" },
        429,
      );
    case "too_long":
      return c.json(
        { message: "daily report too long", code: "daily_report_too_long" },
        400,
      );
  }
}

async function requireUserId(c: AppContext): Promise<string | null> {
  return readSessionUserId(c);
}

function reportId(c: AppContext): string | null {
  const parsed = dailyReportIdSchema.safeParse(c.req.param("id"));
  return parsed.success ? parsed.data : null;
}

async function readJson(c: AppContext): Promise<unknown> {
  return c.req.json().catch(() => null);
}

dailyReportRoutes.get("/api/daily-reports", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ message: "unauthorized" }, 401);
  const reports = await listForUser(createDb(c.env.DB), userId, new Date());
  return c.json(reports);
});

dailyReportRoutes.get("/api/daily-reports/:id", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ message: "unauthorized" }, 401);
  const id = reportId(c);
  if (!id) return invalid(c);
  const result = await getForUser(createDb(c.env.DB), userId, id);
  if (!result.ok) return failure(c, result);
  return c.json(dailyReportSchema.parse(result.report));
});

dailyReportRoutes.post("/api/daily-reports", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ message: "unauthorized" }, 401);
  const parsed = createDailyReportRequestSchema.safeParse(await readJson(c));
  if (!parsed.success) return invalid(c);
  const result = await createForUser(
    createDb(c.env.DB),
    c.env.AI,
    userId,
    parsed.data satisfies CreateDailyReportRequest,
    new Date(),
  );
  if (!result.ok) return failure(c, result);
  return c.json(dailyReportSchema.parse(result.report), 201);
});

dailyReportRoutes.post("/api/daily-reports/:id/append", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ message: "unauthorized" }, 401);
  const id = reportId(c);
  if (!id) return invalid(c);
  const parsed = appendDailyReportRequestSchema.safeParse(await readJson(c));
  if (!parsed.success) return invalid(c);
  const result = await appendForUser(
    createDb(c.env.DB),
    c.env.AI,
    userId,
    id,
    parsed.data satisfies AppendDailyReportRequest,
    new Date(),
  );
  if (!result.ok) return failure(c, result);
  return c.json(dailyReportSchema.parse(result.report));
});

dailyReportRoutes.put("/api/daily-reports/:id", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ message: "unauthorized" }, 401);
  const id = reportId(c);
  if (!id) return invalid(c);
  const parsed = updateDailyReportRequestSchema.safeParse(await readJson(c));
  if (!parsed.success) return invalid(c);
  const result = await updateForUser(
    createDb(c.env.DB),
    userId,
    id,
    parsed.data satisfies UpdateDailyReportRequest,
  );
  if (!result.ok) return failure(c, result);
  return c.json(dailyReportSchema.parse(result.report));
});

dailyReportRoutes.delete("/api/daily-reports/:id", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ message: "unauthorized" }, 401);
  const id = reportId(c);
  if (!id) return invalid(c);
  const result = await deleteForUser(createDb(c.env.DB), userId, id);
  if (!result.ok) return failure(c, result);
  return c.json(deleteDailyReportResponseSchema.parse({ deleted: true }));
});
