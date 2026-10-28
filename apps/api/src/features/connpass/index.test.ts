import {
  connpassNicknameSchema,
  updateConnpassSettingsRequestSchema,
} from "@repo/shared";
import { Jwt } from "hono/utils/jwt";
import { describe, expect, it } from "vitest";
import { connpassRoutes } from "./index";

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

describe("connpass routes without a session", () => {
  it("rejects every route with 401", async () => {
    const get = await connpassRoutes.request("/api/connpass/settings");
    expect(get.status).toBe(401);

    const put = await connpassRoutes.request("/api/connpass/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "taro" }),
    });
    expect(put.status).toBe(401);

    const sync = await connpassRoutes.request("/api/connpass/sync", {
      method: "POST",
    });
    expect(sync.status).toBe(401);
  });
});

describe("PUT /api/connpass/settings validation", () => {
  it("rejects an invalid nickname or body with 400 before touching the DB", async () => {
    const cookie = await sessionCookie();
    const env = { SESSION_SECRET };
    const bodies = [
      JSON.stringify({ nickname: "" }),
      JSON.stringify({ nickname: "a".repeat(51) }),
      JSON.stringify({ nickname: "a/b" }),
      JSON.stringify({ nickname: "a b" }),
      JSON.stringify({}),
      JSON.stringify({ nickname: 1 }),
      "not json",
    ];
    for (const body of bodies) {
      const response = await connpassRoutes.request(
        "/api/connpass/settings",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body,
        },
        env,
      );
      expect(response.status).toBe(400);
    }
  });
});

describe("connpass request schemas", () => {
  it("accepts 1 and 50 characters but not 0 or 51", () => {
    expect(connpassNicknameSchema.safeParse("a").success).toBe(true);
    expect(connpassNicknameSchema.safeParse("a".repeat(50)).success).toBe(true);
    expect(connpassNicknameSchema.safeParse("").success).toBe(false);
    expect(connpassNicknameSchema.safeParse("a".repeat(51)).success).toBe(
      false,
    );
  });

  it("accepts letters, digits, underscore and hyphen only", () => {
    expect(connpassNicknameSchema.safeParse("Taro_1-b").success).toBe(true);
    expect(connpassNicknameSchema.safeParse("太郎").success).toBe(false);
    expect(connpassNicknameSchema.safeParse("a.b").success).toBe(false);
  });

  it("accepts null to clear the nickname", () => {
    expect(
      updateConnpassSettingsRequestSchema.safeParse({ nickname: null }).success,
    ).toBe(true);
  });
});
