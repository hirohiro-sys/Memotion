export type PushResult = "success" | "unreachable" | "transient";

const REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const MAX_PUSH_MESSAGES = 5;

const UNREACHABLE_BODY =
  /not a friend|blocked|cannot send|user not found|not a valid user|invalid user(?:$|[^a-z])|destination user/i;

export function classifyPushFailure(status: number, body: string): PushResult {
  if ((status === 400 || status === 403) && UNREACHABLE_BODY.test(body)) {
    return "unreachable";
  }
  return "transient";
}

function bearerHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function replyFailure(input: {
  accessToken: string;
  replyToken: string;
  text: string;
}): Promise<boolean> {
  try {
    const response = await fetch(REPLY_URL, {
      method: "POST",
      headers: {
        ...bearerHeaders(input.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        replyToken: input.replyToken,
        messages: [{ type: "text", text: input.text }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pushTextMessages(input: {
  accessToken: string;
  to: string;
  texts: readonly string[];
}): Promise<PushResult> {
  const texts = input.texts.slice(0, MAX_PUSH_MESSAGES);
  if (texts.length === 0) return "transient";

  try {
    const response = await fetch(PUSH_URL, {
      method: "POST",
      headers: {
        ...bearerHeaders(input.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: input.to,
        messages: texts.map((text) => ({ type: "text", text })),
      }),
    });
    if (response.ok) return "success";
    return classifyPushFailure(response.status, await response.text());
  } catch {
    return "transient";
  }
}
