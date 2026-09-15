import { Jwt } from "hono/utils/jwt";
import { describe, expect, it } from "vitest";
import { notificationRoutes } from "./routes";

const SESSION_SECRET = "test-secret";

async function sessionCookie(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await Jwt.sign(
    { sub: "user_1", iat: now, exp: now + 3600 },
    SESSION_SECRET,
    "HS256",
  );
  return `sid=${token}`;
}

describe("notification routes without a session", () => {
  it("rejects GET and PATCH with 401", async () => {
    const get = await notificationRoutes.request("/api/notifications");
    expect(get.status).toBe(401);

    const patch = await notificationRoutes.request("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ techWeeklyEnabled: false }),
    });
    expect(patch.status).toBe(401);
  });
});

describe("PATCH /api/notifications validation", () => {
  it("rejects an invalid weekday, time, or body with 400", async () => {
    const cookie = await sessionCookie();
    const env = { SESSION_SECRET };

    const weekday = await notificationRoutes.request(
      "/api/notifications",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ techWeeklyDay: 7 }),
      },
      env,
    );
    expect(weekday.status).toBe(400);

    const time = await notificationRoutes.request(
      "/api/notifications",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ techWeeklyTime: "20:00:00" }),
      },
      env,
    );
    expect(time.status).toBe(400);

    const invalidJson = await notificationRoutes.request(
      "/api/notifications",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: "{",
      },
      env,
    );
    expect(invalidJson.status).toBe(400);
  });
});
