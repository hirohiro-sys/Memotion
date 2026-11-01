import { DAILY_REPORT_GENERATION_LIMIT } from "@repo/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../db";
import {
  dailyReportAiUses,
  dailyReportMemos,
  dailyReports,
} from "../../db/schema";

export type DailyReportRow = {
  id: string;
  reportDate: string;
  kind: string;
  framework: string;
  status: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const summaryColumns = {
  id: dailyReports.id,
  reportDate: dailyReports.reportDate,
  kind: dailyReports.kind,
  framework: dailyReports.framework,
  status: dailyReports.status,
  createdAt: dailyReports.createdAt,
  updatedAt: dailyReports.updatedAt,
};

export async function listReports(db: Database, userId: string) {
  return db
    .select(summaryColumns)
    .from(dailyReports)
    .where(eq(dailyReports.userId, userId))
    .orderBy(
      desc(dailyReports.reportDate),
      sql`case ${dailyReports.kind} when 'work' then 0 else 1 end`,
    );
}

export async function findReport(
  db: Database,
  userId: string,
  id: string,
): Promise<DailyReportRow | null> {
  const [row] = await db
    .select({ ...summaryColumns, body: dailyReports.body })
    .from(dailyReports)
    .where(and(eq(dailyReports.userId, userId), eq(dailyReports.id, id)));
  return row ?? null;
}

export async function findReportByDateKind(
  db: Database,
  userId: string,
  reportDate: string,
  kind: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: dailyReports.id })
    .from(dailyReports)
    .where(
      and(
        eq(dailyReports.userId, userId),
        eq(dailyReports.reportDate, reportDate),
        eq(dailyReports.kind, kind),
      ),
    );
  return row ?? null;
}

export async function findAiUseCount(
  db: Database,
  userId: string,
  usedOn: string,
): Promise<number> {
  const [row] = await db
    .select({ count: dailyReportAiUses.count })
    .from(dailyReportAiUses)
    .where(
      and(
        eq(dailyReportAiUses.userId, userId),
        eq(dailyReportAiUses.usedOn, usedOn),
      ),
    );
  return row?.count ?? 0;
}

export async function listMemoIds(
  db: Database,
  userId: string,
  reportId: string,
): Promise<string[]> {
  const rows = await db
    .select({ memoId: dailyReportMemos.memoId })
    .from(dailyReportMemos)
    .innerJoin(dailyReports, eq(dailyReportMemos.reportId, dailyReports.id))
    .where(
      and(
        eq(dailyReports.userId, userId),
        eq(dailyReportMemos.reportId, reportId),
      ),
    );
  return rows.map((row) => row.memoId);
}

// count が上限未満のときだけ 1 増やす。WHERE が偽なら changes は 0 で、違反にはしない。
export async function claimAiUse(
  db: Database,
  userId: string,
  usedOn: string,
): Promise<boolean> {
  const result = await db.run(sql`
    INSERT INTO daily_report_ai_uses (id, user_id, used_on, count)
    VALUES (${crypto.randomUUID()}, ${userId}, ${usedOn}, 1)
    ON CONFLICT(user_id, used_on) DO UPDATE SET count = count + 1
    WHERE count < ${DAILY_REPORT_GENERATION_LIMIT}
  `);
  return result.meta.changes > 0;
}

export async function refundAiUse(
  db: Database,
  userId: string,
  usedOn: string,
): Promise<void> {
  await db.run(sql`
    UPDATE daily_report_ai_uses
    SET count = count - 1
    WHERE user_id = ${userId} AND used_on = ${usedOn} AND count > 0
  `);
}

export function insertReportStatement(
  db: Database,
  row: {
    id: string;
    userId: string;
    reportDate: string;
    kind: string;
    framework: string;
    body: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return db.insert(dailyReports).values(row);
}

export function insertReportMemosStatement(
  db: Database,
  rows: { id: string; reportId: string; memoId: string }[],
) {
  return db.insert(dailyReportMemos).values(rows);
}

export function updateGeneratedReportStatement(
  db: Database,
  userId: string,
  id: string,
  input: { body: string; framework: string; updatedAt: string },
  expectedUpdatedAt: string,
) {
  return db
    .update(dailyReports)
    .set({
      body: input.body,
      framework: input.framework,
      updatedAt: input.updatedAt,
    })
    .where(
      and(
        eq(dailyReports.userId, userId),
        eq(dailyReports.id, id),
        eq(dailyReports.updatedAt, expectedUpdatedAt),
      ),
    );
}

export async function deleteReportMemos(
  db: Database,
  userId: string,
  reportId: string,
  memoIds: string[],
): Promise<void> {
  if (memoIds.length === 0) return;
  await db
    .delete(dailyReportMemos)
    .where(
      and(
        eq(dailyReportMemos.reportId, reportId),
        inArray(dailyReportMemos.memoId, memoIds),
        sql`${dailyReportMemos.reportId} in (select id from daily_reports where user_id = ${userId})`,
      ),
    );
}

export async function updateReport(
  db: Database,
  userId: string,
  id: string,
  input: {
    body: string;
    status: string;
    framework: string;
    updatedAt: string;
  },
): Promise<boolean> {
  const result = await db
    .update(dailyReports)
    .set({
      body: input.body,
      status: input.status,
      framework: input.framework,
      updatedAt: input.updatedAt,
    })
    .where(and(eq(dailyReports.userId, userId), eq(dailyReports.id, id)));
  return result.meta.changes > 0;
}

export async function deleteReport(
  db: Database,
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(dailyReports)
    .where(and(eq(dailyReports.userId, userId), eq(dailyReports.id, id)));
}
