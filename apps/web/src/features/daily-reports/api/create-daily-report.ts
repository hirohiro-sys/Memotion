import {
  type CreateDailyReportRequest,
  createDailyReportRequestSchema,
  type DailyReport,
  dailyReportSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { throwDailyReport } from "./http-error";

export async function createDailyReport(
  input: CreateDailyReportRequest,
): Promise<DailyReport> {
  const body = createDailyReportRequestSchema.parse(input);
  const res = await apiFetch("/api/daily-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwDailyReport(res);
  return dailyReportSchema.parse(await res.json());
}
