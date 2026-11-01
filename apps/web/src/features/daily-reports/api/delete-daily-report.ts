import { deleteDailyReportResponseSchema } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { DailyReportHttpError } from "./http-error";

export async function deleteDailyReport(id: string): Promise<void> {
  const res = await apiFetch(`/api/daily-reports/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new DailyReportHttpError(res.status);
  deleteDailyReportResponseSchema.parse(await res.json());
}
