import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../env";
import { decideLineEvent, processWebhook } from "./service";

describe("decideLineEvent", () => {
  it("ignores follow, unfollow, unsend, and postback", () => {
    for (const type of ["follow", "unfollow", "unsend", "postback", "read"]) {
      expect(decideLineEvent({ type, replyToken: "r" })).toEqual({
        action: "ignore",
        type,
      });
    }
  });

  it("drops group and room messages without treating them as processable", () => {
    expect(
      decideLineEvent({
        type: "message",
        replyToken: "r",
        source: { type: "group", groupId: "G1", userId: "U1" },
        message: { type: "text", id: "m1", text: "hi" },
      }),
    ).toEqual({
      action: "drop",
      reason: "group",
      sourceType: "group",
      lineUserId: "U1",
    });
    expect(
      decideLineEvent({
        type: "message",
        source: { type: "room", roomId: "R1" },
        message: { type: "text", id: "m1", text: "hi" },
      }),
    ).toMatchObject({ action: "drop", reason: "room" });
  });

  it("processes a 1:1 text message", () => {
    expect(
      decideLineEvent({
        type: "message",
        replyToken: "r",
        source: { type: "user", userId: "U1" },
        message: { type: "text", id: "m1", text: "眠い" },
      }),
    ).toEqual({
      action: "process",
      lineUserId: "U1",
      replyToken: "r",
      messageId: "m1",
      messageType: "text",
      unsupported: false,
      classify: { text: "眠い" },
    });
  });

  it("marks image, sticker, video, audio, file, and location as unsupported", () => {
    for (const messageType of [
      "image",
      "sticker",
      "video",
      "audio",
      "file",
      "location",
    ]) {
      expect(
        decideLineEvent({
          type: "message",
          replyToken: "r",
          source: { type: "user", userId: "U1" },
          message: { type: messageType, id: "m3" },
        }),
      ).toMatchObject({
        action: "process",
        unsupported: true,
        messageType,
      });
    }
  });
});

// 許可の判定は環境変数だけで行う。D1 と KV は渡さず、許可しない人のメモに触れないことを見る。
describe("processWebhook の許可リスト", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function env(overrides: Partial<Env> = {}): Env {
    return {
      LINE_CHANNEL_ACCESS_TOKEN: "token",
      ALLOWED_LINE_USER_IDS: "U_owner",
      APP_USER_ID: "usr_1",
      ...overrides,
    } as Env;
  }

  function body(userId: string, message: Record<string, unknown>) {
    return new TextEncoder().encode(
      JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "r",
            source: { type: "user", userId },
            message,
          },
        ],
      }),
    ).buffer as ArrayBuffer;
  }

  function actions(spy: ReturnType<typeof vi.spyOn>): unknown[] {
    return spy.mock.calls.map(
      (call: unknown[]) => JSON.parse(String(call[0])).action,
    );
  }

  it("許可リストに無い人は unregistered で終え、保存も返信もしない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await processWebhook(
      env(),
      body("U_other", { type: "text", id: "m1", text: "眠い" }),
    );

    expect(actions(log)).toEqual(["unregistered"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("持ち主の ID が無ければ、許可リストにいても unregistered", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await processWebhook(
      env({ APP_USER_ID: undefined }),
      body("U_owner", { type: "text", id: "m1", text: "眠い" }),
    );

    expect(actions(log)).toEqual(["unregistered"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("許可リストにいる人は先へ進む（非対応のメッセージなら返信する）", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await processWebhook(env(), body("U_owner", { type: "sticker", id: "m1" }));

    expect(actions(log)).toEqual(["unsupported"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.line.me/v2/bot/message/reply",
    );
  });
});
