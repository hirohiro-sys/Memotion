import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyPushFailure,
  fetchMessageContent,
  pushTextMessages,
  replyFailure,
} from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("replyFailure", () => {
  it("posts a text message to the Reply API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      replyFailure({
        accessToken: "token",
        replyToken: "reply-1",
        text: "使えるタグは #tweet #tech #other #todo です。",
      }),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/reply",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replyToken: "reply-1",
          messages: [
            {
              type: "text",
              text: "使えるタグは #tweet #tech #other #todo です。",
            },
          ],
        }),
      },
    );
  });

  it("returns false when Reply API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 400 })),
    );

    await expect(
      replyFailure({
        accessToken: "token",
        replyToken: "reply-1",
        text: "保存できませんでした。もう一度送ってください。",
      }),
    ).resolves.toBe(false);
  });
});

describe("fetchMessageContent", () => {
  it("gets the binary from the Content API", async () => {
    const body = new Uint8Array([1, 2, 3]).buffer;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const content = await fetchMessageContent({
      accessToken: "token",
      messageId: "mid-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api-data.line.me/v2/bot/message/mid-1/content",
      { headers: { Authorization: "Bearer token" } },
    );
    expect(content?.contentType).toBe("image/jpeg");
    expect(content && [...new Uint8Array(content.body)]).toEqual([1, 2, 3]);
  });

  it("returns null when Content API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    await expect(
      fetchMessageContent({ accessToken: "token", messageId: "mid-1" }),
    ).resolves.toBeNull();
  });
});

describe("classifyPushFailure", () => {
  it("treats 400/403 friend, block, and user-not-found bodies as unreachable", () => {
    expect(
      classifyPushFailure(
        400,
        "The user is not a friend of this bot or has blocked the bot.",
      ),
    ).toBe("unreachable");
    expect(
      classifyPushFailure(403, "You cannot send a message to this user."),
    ).toBe("unreachable");
    expect(classifyPushFailure(400, "The userId is not a valid user ID")).toBe(
      "unreachable",
    );
  });

  it("treats a malformed 400, 401, 429, and 5xx as transient", () => {
    expect(classifyPushFailure(400, "The request body has 2 error(s)")).toBe(
      "transient",
    );
    expect(classifyPushFailure(401, "Authentication failed. Confirm...")).toBe(
      "transient",
    );
    expect(classifyPushFailure(429, "Too Many Requests")).toBe("transient");
    expect(classifyPushFailure(500, "internal error")).toBe("transient");
    expect(classifyPushFailure(403, "")).toBe("transient");
  });
});

describe("pushTextMessages", () => {
  it("posts up to 5 texts in one Push request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const texts = ["1", "2", "3", "4", "5", "6"];
    await expect(
      pushTextMessages({
        accessToken: "token",
        to: "U1",
        texts,
      }),
    ).resolves.toBe("success");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "U1",
          messages: [
            { type: "text", text: "1" },
            { type: "text", text: "2" },
            { type: "text", text: "3" },
            { type: "text", text: "4" },
            { type: "text", text: "5" },
          ],
        }),
      },
    );
  });

  it("returns unreachable when LINE says the user cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message:
              "The user is not a friend of this bot or has blocked the bot.",
          }),
          { status: 400 },
        ),
      ),
    );

    await expect(
      pushTextMessages({
        accessToken: "token",
        to: "U1",
        texts: ["今週のTech 1件"],
      }),
    ).resolves.toBe("unreachable");
  });

  it("returns transient on 401 and on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid token", { status: 401 })),
    );
    await expect(
      pushTextMessages({ accessToken: "bad", to: "U1", texts: ["x"] }),
    ).resolves.toBe("transient");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(
      pushTextMessages({ accessToken: "token", to: "U1", texts: ["x"] }),
    ).resolves.toBe("transient");
  });
});
