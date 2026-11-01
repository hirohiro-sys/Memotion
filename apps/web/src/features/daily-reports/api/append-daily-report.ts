import {
  type AppendDailyReportRequest,
  appendDailyReportRequestSchema,
  type DailyReport,
  dailyReportSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { throwDailyReport } from "./http-error";

export async function appendDailyReport(
  id: string,
  input: AppendDailyReportRequest,
): Promise<DailyReport> {
  const body = appendDailyReportRequestSchema.parse(input);
  const res = await apiFetch(
    `/api/daily-reports/${encodeURIComponent(id)}/append`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await throwDailyReport(res);
  return dailyReportSchema.parse(await res.json());
}
