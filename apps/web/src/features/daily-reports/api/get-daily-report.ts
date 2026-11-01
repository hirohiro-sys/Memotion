import { type DailyReport, dailyReportSchema } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { DailyReportHttpError } from "./http-error";

export async function fetchDailyReport(id: string): Promise<DailyReport> {
  const res = await apiFetch(`/api/daily-reports/${encodeURIComponent(id)}`);
  if (!res.ok) throw new DailyReportHttpError(res.status);
  return dailyReportSchema.parse(await res.json());
}
