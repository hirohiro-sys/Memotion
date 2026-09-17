import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Jwt } from "hono/utils/jwt";
import type { Env } from "../env";

export const SID_COOKIE = "sid";
export const OAUTH_STATE_COOKIE = "oauth_state";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type AppContext = Context<{ Bindings: Env }>;

function cookieOpts(c: AppContext) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax" as const,
    secure: new URL(c.env.APP_URL).protocol === "https:",
  };
}

export async function issueSession(c: AppContext, userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = await Jwt.sign(
    { sub: userId, iat: now, exp: now + SESSION_MAX_AGE },
    c.env.SESSION_SECRET,
    "HS256",
  );
  setCookie(c, SID_COOKIE, token, {
    ...cookieOpts(c),
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSession(c: AppContext) {
  deleteCookie(c, SID_COOKIE, cookieOpts(c));
}

export async function readSessionUserId(c: AppContext): Promise<string | null> {
  const token = getCookie(c, SID_COOKIE);
  if (!token) return null;
  try {
    const payload = await Jwt.verify(token, c.env.SESSION_SECRET, "HS256");
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function issueOAuthState(c: AppContext): string {
  const state = crypto.randomUUID();
  setCookie(c, OAUTH_STATE_COOKIE, state, { ...cookieOpts(c), maxAge: 600 });
  return state;
}

export function consumeOAuthState(
  c: AppContext,
  state: string | undefined,
): boolean {
  const expected = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, cookieOpts(c));
  return Boolean(state && expected && state === expected);
}
