import {
  apiErrorSchema,
  createDailyReportRequestSchema,
  dailyReportExistsErrorSchema,
  MAX_DAILY_REPORT_BODY,
  MAX_DAILY_REPORT_MEMOS,
  updateDailyReportRequestSchema,
} from "@repo/shared";
import { Jwt } from "hono/utils/jwt";
import { describe, expect, it } from "vitest";
import { dailyReportRoutes } from "./index";

const SESSION_SECRET = "test-secret";
const env = { SESSION_SECRET };

const validReport = {
  reportDate: "2026-10-29",
  kind: "work" as const,
  framework: "log" as const,
  memoIds: ["memo_1"],
};

async function sessionCookie(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await Jwt.sign(
    { sub: "user_1", iat: now, exp: now + 3600 },
    SESSION_SECRET,
    "HS256",
  );
  return `sid=${token}`;
}

function request(method: string, path: string, body?: string, cookie?: string) {
  return dailyReportRoutes.request(
    path,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
    },
    env,
  );
}

describe("daily report contract", () => {
  it("rejects a duplicate memo id, 91 ids, and a non-existent date", () => {
    expect(
      createDailyReportRequestSchema.safeParse({
        ...validReport,
        memoIds: ["memo_1", "memo_1"],
      }).success,
    ).toBe(false);
    expect(
      createDailyReportRequestSchema.safeParse({
        ...validReport,
        memoIds: Array.from(
          { length: MAX_DAILY_REPORT_MEMOS + 1 },
          (_, index) => `memo_${index}`,
        ),
      }).success,
    ).toBe(false);
    expect(
      createDailyReportRequestSchema.safeParse({
        ...validReport,
        reportDate: "2026-02-30",
      }).success,
    ).toBe(false);
  });

  it("accepts 90 distinct memo ids", () => {
    expect(
      createDailyReportRequestSchema.safeParse({
        ...validReport,
        memoIds: Array.from(
          { length: MAX_DAILY_REPORT_MEMOS },
          (_, index) => `memo_${index}`,
        ),
      }).success,
    ).toBe(true);
  });

  it("rejects a blank body and a body of 20001 characters", () => {
    expect(
      updateDailyReportRequestSchema.safeParse({
        body: "   ",
        status: "draft",
        framework: "log",
      }).success,
    ).toBe(false);
    expect(
      updateDailyReportRequestSchema.safeParse({
        body: "a".repeat(MAX_DAILY_REPORT_BODY + 1),
        status: "draft",
        framework: "log",
      }).success,
    ).toBe(false);
    expect(
      updateDailyReportRequestSchema.safeParse({
        body: "a".repeat(MAX_DAILY_REPORT_BODY),
        status: "confirmed",
        framework: "achievement",
      }).success,
    ).toBe(true);
  });

  it("keeps dailyReportId on the exists error and strips it from the generic error", () => {
    expect(
      dailyReportExistsErrorSchema.parse({
        message: "daily report exists",
        code: "daily_report_exists",
        dailyReportId: "report_1",
      }),
    ).toEqual({
      message: "daily report exists",
      code: "daily_report_exists",
      dailyReportId: "report_1",
    });
    expect(
      apiErrorSchema.parse({
        message: "daily report exists",
        code: "daily_report_exists",
        dailyReportId: "report_1",
      }),
    ).toEqual({
      message: "daily report exists",
      code: "daily_report_exists",
    });
  });
});

describe("daily report routes", () => {
  it.each([
    ["GET", "/api/daily-reports"],
    ["GET", "/api/daily-reports/report_1"],
    ["POST", "/api/daily-reports"],
    ["POST", "/api/daily-reports/report_1/append"],
    ["PUT", "/api/daily-reports/report_1"],
    ["DELETE", "/api/daily-reports/report_1"],
  ])(
    "%s %s is 401 without a session, even when the body is not JSON",
    async (method, path) => {
      const res = await request(
        method,
        path,
        method === "GET" || method === "DELETE" ? undefined : "{",
      );
      expect(res.status).toBe(401);
    },
  );

  it("rejects an invalid create and append body before touching the database", async () => {
    const cookie = await sessionCookie();
    const create = await request(
      "POST",
      "/api/daily-reports",
      JSON.stringify({ ...validReport, reportDate: "2026-02-30" }),
      cookie,
    );
    const append = await request(
      "POST",
      "/api/daily-reports/report_1/append",
      JSON.stringify({ framework: "log" }),
      cookie,
    );
    expect(create.status).toBe(400);
    expect(append.status).toBe(400);
  });

  it("rejects a blank save and a 65 character id before touching the database", async () => {
    const cookie = await sessionCookie();
    const blank = await request(
      "PUT",
      "/api/daily-reports/report_1",
      JSON.stringify({ body: "   ", status: "draft", framework: "log" }),
      cookie,
    );
    const longId = await request(
      "PUT",
      `/api/daily-reports/${"a".repeat(65)}`,
      JSON.stringify({ body: "本文", status: "draft", framework: "log" }),
      cookie,
    );
    expect(blank.status).toBe(400);
    expect(longId.status).toBe(400);
  });
});
