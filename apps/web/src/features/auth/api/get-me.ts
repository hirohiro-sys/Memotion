import { type User, userSchema } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { clearStoredUserId, setStoredUserId } from "../stored-user-id";

const ME_TIMEOUT_MS = 5_000;

// サーバーに届かなかった（通信の例外・タイムアウト）ことを、5xx などと区別するためのエラー。
export class SessionCheckNetworkError extends Error {
  constructor() {
    super("could not reach the server to check the session");
    this.name = "SessionCheckNetworkError";
  }
}

export async function fetchMe(): Promise<User | null> {
  let res: Response;
  try {
    res = await apiFetch("/api/me", {
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    });
  } catch {
    throw new SessionCheckNetworkError();
  }
  if (res.status === 401) {
    clearStoredUserId();
    return null;
  }
  if (!res.ok) throw new Error("failed to load session");
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // 本文の途中で通信が切れた、またはタイムアウトした。
    throw new SessionCheckNetworkError();
  }
  const user = userSchema.parse(body);
  setStoredUserId(user.id);
  return user;
}
