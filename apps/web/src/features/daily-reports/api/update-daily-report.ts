import {
  type DailyReport,
  dailyReportSchema,
  type UpdateDailyReportRequest,
  updateDailyReportRequestSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { DailyReportHttpError } from "./http-error";

export async function updateDailyReport(
  id: string,
  input: UpdateDailyReportRequest,
): Promise<DailyReport> {
  const body = updateDailyReportRequestSchema.parse(input);
  const res = await apiFetch(`/api/daily-reports/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new DailyReportHttpError(res.status);
  return dailyReportSchema.parse(await res.json());
}
