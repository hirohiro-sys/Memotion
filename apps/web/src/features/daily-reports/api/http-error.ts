import { dailyReportExistsErrorSchema } from "@repo/shared";

export class DailyReportHttpError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code?: string) {
    super("daily report request failed");
    this.name = "DailyReportHttpError";
    this.status = status;
    this.code = code;
  }
}

export class DailyReportExistsError extends Error {
  readonly dailyReportId: string;

  constructor(dailyReportId: string) {
    super("daily report exists");
    this.name = "DailyReportExistsError";
    this.dailyReportId = dailyReportId;
  }
}

export async function throwDailyReport(res: Response): Promise<never> {
  const body: unknown = await res.json().catch(() => null);
  const exists = dailyReportExistsErrorSchema.safeParse(body);
  if (res.status === 409 && exists.success) {
    throw new DailyReportExistsError(exists.data.dailyReportId);
  }
  const code =
    body &&
    typeof body === "object" &&
    "code" in body &&
    typeof body.code === "string"
      ? body.code
      : undefined;
  throw new DailyReportHttpError(res.status, code);
}

export function dailyReportErrorTitle(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof DailyReportHttpError)) return fallback;
  if (error.status === 429 || error.code === "daily_report_ai_limit") {
    return "今日の生成回数を使い切りました。";
  }
  if (error.code === "daily_report_too_long") return "本文が長すぎます。";
  if (error.code === "daily_report_memo_ineligible") {
    return "グループに入っているメモは使えません。";
  }
  if (error.status === 502 || error.code === "daily_report_unavailable") {
    return "日報を生成できませんでした。";
  }
  return fallback;
}
