import { describe, expect, it } from "vitest";
import type { Env } from "../../env";
import { devLoginAllowed } from "./dev-login";
import { auth } from "./index";

const LOCAL_APP = "http://127.0.0.1:5173";
const LOCAL_REQUEST = "http://127.0.0.1:8787/api/auth/dev";
const PRODUCTION_APP =
  "https://line-memo-orchestrator.hirohiro-sys.workers.dev";

describe("devLoginAllowed", () => {
  it("allows http loopback for both the app and the request", () => {
    expect(
      devLoginAllowed({ appUrl: LOCAL_APP, requestUrl: LOCAL_REQUEST }),
    ).toBe(true);
    expect(
      devLoginAllowed({
        appUrl: "http://localhost:5173",
        requestUrl: "http://localhost:8787/api/auth/dev",
      }),
    ).toBe(true);
  });

  it("rejects https, a public host, and a malformed url", () => {
    expect(
      devLoginAllowed({ appUrl: PRODUCTION_APP, requestUrl: LOCAL_REQUEST }),
    ).toBe(false);
    expect(
      devLoginAllowed({
        appUrl: LOCAL_APP,
        requestUrl: `${PRODUCTION_APP}/api/auth/dev`,
      }),
    ).toBe(false);
    expect(
      devLoginAllowed({
        appUrl: "http://192.168.1.1:5173",
        requestUrl: LOCAL_REQUEST,
      }),
    ).toBe(false);
    expect(
      devLoginAllowed({
        appUrl: LOCAL_APP,
        requestUrl: "http://192.168.1.1:8787/api/auth/dev",
      }),
    ).toBe(false);
    expect(
      devLoginAllowed({
        appUrl: "http://127.0.0.1.evil.com",
        requestUrl: LOCAL_REQUEST,
      }),
    ).toBe(false);
    expect(devLoginAllowed({ appUrl: "", requestUrl: LOCAL_REQUEST })).toBe(
      false,
    );
    expect(
      devLoginAllowed({
        appUrl: "https://127.0.0.1:5173",
        requestUrl: LOCAL_REQUEST,
      }),
    ).toBe(false);
  });
});

describe("GET /api/auth/dev", () => {
  it("returns 404 when the app url is not a local http loopback", async () => {
    const res = await auth.request(
      LOCAL_REQUEST,
      undefined,
      env(PRODUCTION_APP),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the request itself is not a local http loopback", async () => {
    const res = await auth.request(
      `${PRODUCTION_APP}/api/auth/dev`,
      undefined,
      env(LOCAL_APP),
    );
    expect(res.status).toBe(404);
  });
});

function env(appUrl: string): Env {
  return {
    APP_URL: appUrl,
    DB: {} as Env["DB"],
    MEDIA: {} as Env["MEDIA"],
    LINE_CHANNEL_ID: "id",
    LINE_CHANNEL_SECRET: "secret",
    LINE_MESSAGING_CHANNEL_SECRET: "secret",
    LINE_CHANNEL_ACCESS_TOKEN: "token",
    SESSION_SECRET: "session-secret",
  };
}
