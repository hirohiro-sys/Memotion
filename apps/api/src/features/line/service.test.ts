import { describe, expect, it } from "vitest";
import { decideLineEvent } from "./service";

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
        message: { type: "text", id: "m1", text: "#tweet眠い" },
      }),
    ).toEqual({
      action: "process",
      lineUserId: "U1",
      replyToken: "r",
      messageId: "m1",
      messageType: "text",
      unsupported: false,
      classify: { text: "#tweet眠い", isImage: false },
    });
  });

  it("processes a 1:1 image message", () => {
    expect(
      decideLineEvent({
        type: "message",
        replyToken: "r",
        source: { type: "user", userId: "U1" },
        message: { type: "image", id: "m2" },
      }),
    ).toMatchObject({
      action: "process",
      messageType: "image",
      unsupported: false,
      classify: { isImage: true },
    });
  });

  it("marks sticker, video, audio, file, and location as unsupported", () => {
    for (const messageType of [
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
