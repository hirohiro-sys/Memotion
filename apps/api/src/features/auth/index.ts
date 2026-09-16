import { userSchema } from "@repo/shared";
import { Hono } from "hono";
import { createDb } from "../../db";
import type { Env } from "../../env";
import {
  clearSession,
  consumeOAuthState,
  issueOAuthState,
  issueSession,
  readSessionUserId,
} from "../../lib/session";
import { findUserIdByLineUserId } from "./repository";
import { callbackUrl, exchangeCodeForLineUserId, frontendUrl } from "./service";

const LINE_AUTHORIZE = "https://access.line.me/oauth2/v2.1/authorize";

export const auth = new Hono<{ Bindings: Env }>();

auth.get("/api/auth/line", (c) => {
  const state = issueOAuthState(c);
  const url = new URL(LINE_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", c.env.LINE_CHANNEL_ID);
  url.searchParams.set("redirect_uri", callbackUrl(c.req.url));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid");
  return c.redirect(url.toString());
});

auth.get("/api/auth/line/callback", async (c) => {
  const error = c.req.query("error");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const appUrl = c.env.APP_URL;

  if (error === "access_denied") {
    consumeOAuthState(c, state);
    return c.redirect(frontendUrl(appUrl, "/login?error=cancelled"));
  }

  if (error || !consumeOAuthState(c, state) || !code) {
    return c.redirect(frontendUrl(appUrl, "/login?error=failed"));
  }

  try {
    const lineUserId = await exchangeCodeForLineUserId({
      code,
      redirectUri: callbackUrl(c.req.url),
      channelId: c.env.LINE_CHANNEL_ID,
      channelSecret: c.env.LINE_CHANNEL_SECRET,
    });
    const userId = await findUserIdByLineUserId(createDb(c.env.DB), lineUserId);

    if (!userId) {
      return c.redirect(frontendUrl(appUrl, "/login?error=denied"));
    }

    await issueSession(c, userId);
    return c.redirect(frontendUrl(appUrl, "/"));
  } catch {
    return c.redirect(frontendUrl(appUrl, "/login?error=failed"));
  }
});

auth.post("/api/auth/logout", (c) => {
  clearSession(c);
  return c.body(null, 204);
});

auth.get("/api/me", async (c) => {
  const id = await readSessionUserId(c);
  if (!id) {
    return c.json({ message: "unauthorized" }, 401);
  }
  return c.json(userSchema.parse({ id }));
});
