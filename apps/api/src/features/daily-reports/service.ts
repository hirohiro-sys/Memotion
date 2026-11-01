import {
  type AppendDailyReportRequest,
  type CreateDailyReportRequest,
  DAILY_REPORT_GENERATION_LIMIT,
  type DailyReport,
  type DailyReportFramework,
  type DailyReportListResponse,
  dailyReportListResponseSchema,
  dailyReportSchema,
  type UpdateDailyReportRequest,
} from "@repo/shared";
import type { Database } from "../../db";
import { jstDateOf } from "../memos/schedule";
import { findOwnedByIds, type OwnedMemo } from "../memos/service";
import {
  bodyWithinLimit,
  isModelTextEmpty,
  joinBody,
  withHeading,
} from "./body";
import { generateDailyReport } from "./client";
import { isDailyReportUniqueViolation } from "./constraint-error";
import { decideMemoUse } from "./eligibility";
import { headingLine } from "./heading";
import { chunkMemoLinks } from "./memo-links";
import { buildPrompt, comparePromptOrder, type PromptMemo } from "./prompt";
import {
  claimAiUse,
  deleteReport,
  deleteReportMemos,
  findAiUseCount,
  findReport,
  findReportByDateKind,
  insertReportMemosStatement,
  insertReportStatement,
  listMemoIds,
  listReports,
  refundAiUse,
  updateGeneratedReportStatement,
  updateReport,
} from "./repository";

type NotFound = { ok: false; error: "not_found" };
type MemoNotFound = { ok: false; error: "memo_not_found" };
type Ineligible = { ok: false; error: "ineligible" };
type Exists = { ok: false; error: "exists"; dailyReportId: string };
type Invalid = { ok: false; error: "invalid" };
type Unavailable = { ok: false; error: "unavailable" };
type Limit = { ok: false; error: "limit" };
type TooLong = { ok: false; error: "too_long" };
type Ready = { ok: true; report: DailyReport };
type Generated =
  | { ok: true; body: string; usedOn: string }
  | Unavailable
  | Limit
  | TooLong;

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

function logFailure(
  userId: string,
  reason: "limit" | "upstream" | "empty" | "too_long" | "no_secret" | "write",
) {
  logJson({
    event: "daily_report.generate",
    status: "failed",
    reason,
    userId,
  });
}

function toPromptMemos(rows: readonly OwnedMemo[]): PromptMemo[] {
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    url: row.url,
    tag: row.tag,
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
  }));
}

function linkRows(reportId: string, memoIds: readonly string[]) {
  return memoIds.map((memoId) => ({
    id: crypto.randomUUID(),
    reportId,
    memoId,
  }));
}

function memoLinkStatements(
  db: Database,
  rows: { id: string; reportId: string; memoId: string }[],
) {
  return chunkMemoLinks(rows).map((chunk) =>
    insertReportMemosStatement(db, chunk),
  );
}

function changedRows(result: unknown): number | null {
  if (!result || typeof result !== "object" || !("meta" in result)) return null;
  const meta = result.meta;
  if (!meta || typeof meta !== "object" || !("changes" in meta)) return null;
  return typeof meta.changes === "number" ? meta.changes : null;
}

async function refundQuietly(db: Database, userId: string, usedOn: string) {
  try {
    await refundAiUse(db, userId, usedOn);
  } catch {
    logFailure(userId, "write");
  }
}

async function orderedMemoIds(
  db: Database,
  userId: string,
  reportId: string,
): Promise<string[]> {
  const linked = await listMemoIds(db, userId, reportId);
  if (linked.length === 0) return [];
  const memos = await findOwnedByIds(db, userId, linked);
  return memos.sort(comparePromptOrder).map((memo) => memo.id);
}

async function spendGeneration(
  db: Database,
  ai: Ai | undefined,
  userId: string,
  now: Date,
  framework: DailyReportFramework,
  memos: readonly OwnedMemo[],
  compose: (modelText: string) => string,
): Promise<Generated> {
  if (!ai) {
    logFailure(userId, "no_secret");
    return { ok: false, error: "unavailable" };
  }
  const usedOn = jstDateOf(now);
  const claimed = await claimAiUse(db, userId, usedOn);
  if (!claimed) {
    logFailure(userId, "limit");
    return { ok: false, error: "limit" };
  }
  const fail = async (
    reason: "upstream" | "empty" | "too_long" | "no_secret",
    error: "unavailable" | "too_long",
  ): Promise<Generated> => {
    await refundQuietly(db, userId, usedOn);
    logFailure(userId, reason);
    return { ok: false, error };
  };
  const prompt = buildPrompt(framework, toPromptMemos(memos));
  if (!prompt.ok) return fail("upstream", "unavailable");
  const generated = await generateDailyReport(ai, prompt.text);
  if (!generated.ok) return fail(generated.reason, "unavailable");
  if (isModelTextEmpty(generated.text)) return fail("empty", "unavailable");
  const body = compose(generated.text.trim());
  if (!bodyWithinLimit(body)) return fail("too_long", "too_long");
  return { ok: true, body, usedOn };
}

export async function listForUser(
  db: Database,
  userId: string,
  now: Date,
): Promise<DailyReportListResponse> {
  const reports = await listReports(db, userId);
  const used = await findAiUseCount(db, userId, jstDateOf(now));
  return dailyReportListResponseSchema.parse({
    reports,
    remainingGenerations: Math.max(0, DAILY_REPORT_GENERATION_LIMIT - used),
  });
}

export async function getForUser(
  db: Database,
  userId: string,
  id: string,
): Promise<Ready | NotFound> {
  const report = await findReport(db, userId, id);
  if (!report) return { ok: false, error: "not_found" };
  const memoIds = await orderedMemoIds(db, userId, report.id);
  return { ok: true, report: dailyReportSchema.parse({ ...report, memoIds }) };
}

export async function updateForUser(
  db: Database,
  userId: string,
  id: string,
  input: UpdateDailyReportRequest,
): Promise<Ready | NotFound> {
  const report = await findReport(db, userId, id);
  if (!report) return { ok: false, error: "not_found" };
  const updatedAt = new Date().toISOString();
  const wrote = await updateReport(db, userId, id, {
    body: input.body,
    status: input.status,
    framework: input.framework,
    updatedAt,
  });
  if (!wrote) return { ok: false, error: "not_found" };
  const memoIds = await orderedMemoIds(db, userId, id);
  return {
    ok: true,
    report: dailyReportSchema.parse({
      ...report,
      body: input.body,
      status: input.status,
      framework: input.framework,
      updatedAt,
      memoIds,
    }),
  };
}

export async function deleteForUser(
  db: Database,
  userId: string,
  id: string,
): Promise<{ ok: true } | NotFound> {
  const report = await findReport(db, userId, id);
  if (!report) return { ok: false, error: "not_found" };
  await deleteReport(db, userId, id);
  return { ok: true };
}

export async function createForUser(
  db: Database,
  ai: Ai | undefined,
  userId: string,
  input: CreateDailyReportRequest,
  now: Date,
): Promise<
  | Ready
  | MemoNotFound
  | Ineligible
  | Exists
  | Unavailable
  | Limit
  | TooLong
  | NotFound
> {
  const rows = await findOwnedByIds(db, userId, input.memoIds);
  const decision = decideMemoUse(input.memoIds, rows);
  if (decision === "not_found") return { ok: false, error: "memo_not_found" };
  if (decision === "ineligible") return { ok: false, error: "ineligible" };
  const existing = await findReportByDateKind(
    db,
    userId,
    input.reportDate,
    input.kind,
  );
  if (existing) {
    return { ok: false, error: "exists", dailyReportId: existing.id };
  }
  const heading = headingLine(input.reportDate, input.kind);
  const generated = await spendGeneration(
    db,
    ai,
    userId,
    now,
    input.framework,
    rows,
    (modelText) => withHeading(heading, modelText),
  );
  if (!generated.ok) return generated;
  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  try {
    const statements = [
      insertReportStatement(db, {
        id,
        userId,
        reportDate: input.reportDate,
        kind: input.kind,
        framework: input.framework,
        body: generated.body,
        status: "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      ...memoLinkStatements(db, linkRows(id, input.memoIds)),
    ] as const;
    await db.batch(statements);
  } catch (error) {
    await refundQuietly(db, userId, generated.usedOn);
    if (isDailyReportUniqueViolation(error)) {
      const winner = await findReportByDateKind(
        db,
        userId,
        input.reportDate,
        input.kind,
      );
      if (winner)
        return { ok: false, error: "exists", dailyReportId: winner.id };
      return { ok: false, error: "not_found" };
    }
    logFailure(userId, "write");
    return { ok: false, error: "unavailable" };
  }
  const memoIds = await orderedMemoIds(db, userId, id);
  return {
    ok: true,
    report: dailyReportSchema.parse({
      id,
      reportDate: input.reportDate,
      kind: input.kind,
      framework: input.framework,
      status: "draft",
      body: generated.body,
      createdAt: timestamp,
      updatedAt: timestamp,
      memoIds,
    }),
  };
}

export async function appendForUser(
  db: Database,
  ai: Ai | undefined,
  userId: string,
  id: string,
  input: AppendDailyReportRequest,
  now: Date,
): Promise<
  | Ready
  | NotFound
  | MemoNotFound
  | Ineligible
  | Invalid
  | Unavailable
  | Limit
  | TooLong
> {
  const report = await findReport(db, userId, id);
  if (!report) return { ok: false, error: "not_found" };
  const rows = await findOwnedByIds(db, userId, input.memoIds);
  const decision = decideMemoUse(input.memoIds, rows);
  if (decision === "not_found") return { ok: false, error: "memo_not_found" };
  if (decision === "ineligible") return { ok: false, error: "ineligible" };
  const linked = new Set(await listMemoIds(db, userId, id));
  const fresh = rows.filter((row) => !linked.has(row.id));
  if (fresh.length === 0) return { ok: false, error: "invalid" };
  if (!bodyWithinLimit(joinBody(report.body, "x"))) {
    return { ok: false, error: "too_long" };
  }
  const generated = await spendGeneration(
    db,
    ai,
    userId,
    now,
    input.framework,
    fresh,
    (modelText) => joinBody(report.body, modelText),
  );
  if (!generated.ok) return generated;
  const updatedAt = now.toISOString();
  const freshIds = fresh.map((row) => row.id);
  try {
    const statements = [
      updateGeneratedReportStatement(
        db,
        userId,
        id,
        {
          body: generated.body,
          framework: input.framework,
          updatedAt,
        },
        report.updatedAt,
      ),
      ...memoLinkStatements(db, linkRows(id, freshIds)),
    ] as const;
    const [updated] = await db.batch(statements);
    if (changedRows(updated) === 0) {
      try {
        await deleteReportMemos(db, userId, id, freshIds);
      } catch {
        // 対応が残っても、下で回数を戻して 502 にする。
      }
      await refundQuietly(db, userId, generated.usedOn);
      logFailure(userId, "write");
      const still = await findReport(db, userId, id);
      if (!still) return { ok: false, error: "not_found" };
      return { ok: false, error: "unavailable" };
    }
  } catch (error) {
    await refundQuietly(db, userId, generated.usedOn);
    if (!isDailyReportUniqueViolation(error)) logFailure(userId, "write");
    const still = await findReport(db, userId, id);
    if (!still) return { ok: false, error: "not_found" };
    return { ok: false, error: "unavailable" };
  }
  const memoIds = await orderedMemoIds(db, userId, id);
  return {
    ok: true,
    report: dailyReportSchema.parse({
      ...report,
      body: generated.body,
      framework: input.framework,
      updatedAt,
      memoIds,
    }),
  };
}
