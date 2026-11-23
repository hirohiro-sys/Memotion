import type { Database } from "../../db";
import type { Env } from "../../env";
import { appUserIdFor } from "./allowlist";
import { ensureDevUser } from "./repository";

const LINE_TOKEN = "https://api.line.me/oauth2/v2.1/token";
const LINE_VERIFY = "https://api.line.me/oauth2/v2.1/verify";

export function callbackUrl(requestUrl: string) {
  return new URL("/api/auth/line/callback", requestUrl).href;
}

export function frontendUrl(appUrl: string, path: string) {
  return new URL(path, `${appUrl.replace(/\/$/, "")}/`).href;
}

export async function exchangeCodeForLineUserId(input: {
  code: string;
  redirectUri: string;
  channelId: string;
  channelSecret: string;
}): Promise<string> {
  const tokenRes = await fetch(LINE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.channelId,
      client_secret: input.channelSecret,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error("token exchange failed");
  }

  const tokenJson: unknown = await tokenRes.json();
  const idToken = readStringField(tokenJson, "id_token");
  if (!idToken) {
    throw new Error("missing id_token");
  }

  const verifyRes = await fetch(LINE_VERIFY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: input.channelId,
    }),
  });
  if (!verifyRes.ok) {
    throw new Error("id_token verify failed");
  }

  const verifyJson: unknown = await verifyRes.json();
  const sub = readStringField(verifyJson, "sub");
  if (!sub) {
    throw new Error("missing sub");
  }
  return sub;
}

// LINE のユーザー ID から、許可リスト（環境変数）にあればアプリのユーザー ID を返す。無ければ null。
export function resolveUserIdByLineUserId(
  env: Pick<Env, "ALLOWED_LINE_USER_IDS" | "APP_USER_ID">,
  lineUserId: string,
): string | null {
  return appUserIdFor({
    allowedLineUserIds: env.ALLOWED_LINE_USER_IDS,
    appUserId: env.APP_USER_ID,
    lineUserId,
  });
}

// 開発用ログインの固定ユーザーを用意し、そのユーザー ID を返す。
export function prepareDevUser(db: Database, now: Date): Promise<string> {
  return ensureDevUser(db, now.toISOString());
}

function readStringField(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }
  const field = Reflect.get(value, key);
  return typeof field === "string" ? field : null;
}
