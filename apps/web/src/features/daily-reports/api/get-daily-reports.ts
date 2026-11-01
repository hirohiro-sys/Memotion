import {
  type DailyReportListResponse,
  dailyReportListResponseSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { DailyReportHttpError } from "./http-error";

export async function fetchDailyReports(): Promise<DailyReportListResponse> {
  const res = await apiFetch("/api/daily-reports");
  if (!res.ok) throw new DailyReportHttpError(res.status);
  return dailyReportListResponseSchema.parse(await res.json());
}
