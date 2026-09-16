import { createDb } from "../../db";
import type { Env } from "../../env";
import { replyFailure } from "../../lib/line/client";
import { findUserIdByLineUserId } from "../auth/repository";
import { classify, type LineFailReason, replyTextFor } from "../memos/classify";
import { createFromLine } from "../memos/service";

export type LineEventDecision =
  | { action: "ignore"; type: string }
  | {
      action: "drop";
      reason: "group" | "room" | "no_user";
      sourceType: string;
      lineUserId?: string;
    }
  | {
      action: "process";
      lineUserId: string;
      replyToken?: string;
      messageId?: string;
      messageType: string;
      unsupported: boolean;
      classify?: { text?: string; isImage: boolean };
    };

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export function decideLineEvent(event: unknown): LineEventDecision {
  const record = asRecord(event);
  const type = record ? (readString(record, "type") ?? "unknown") : "unknown";
  if (type !== "message") {
    return { action: "ignore", type };
  }

  const source = record ? asRecord(record.source) : null;
  const sourceType = source
    ? (readString(source, "type") ?? "unknown")
    : "unknown";
  const lineUserId = source ? readString(source, "userId") : undefined;
  const replyToken = record ? readString(record, "replyToken") : undefined;
  const message = record ? asRecord(record.message) : null;
  const messageType = message
    ? (readString(message, "type") ?? "unknown")
    : "unknown";
  const messageId = message ? readString(message, "id") : undefined;
  const text = message ? readString(message, "text") : undefined;

  if (sourceType === "group" || sourceType === "room") {
    return { action: "drop", reason: sourceType, sourceType, lineUserId };
  }
  if (sourceType !== "user" || !lineUserId) {
    return { action: "drop", reason: "no_user", sourceType, lineUserId };
  }

  if (messageType === "text") {
    return {
      action: "process",
      lineUserId,
      replyToken,
      messageId,
      messageType,
      unsupported: false,
      classify: { text, isImage: false },
    };
  }
  if (messageType === "image") {
    return {
      action: "process",
      lineUserId,
      replyToken,
      messageId,
      messageType,
      unsupported: false,
      classify: { isImage: true },
    };
  }
  return {
    action: "process",
    lineUserId,
    replyToken,
    messageId,
    messageType,
    unsupported: true,
  };
}

async function replyIfPossible(
  env: Env,
  replyToken: string | undefined,
  reason: LineFailReason,
) {
  if (!replyToken) return;
  await replyFailure({
    accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
    replyToken,
    text: replyTextFor(reason),
  });
}

async function handleEvent(env: Env, event: unknown): Promise<void> {
  const decision = decideLineEvent(event);

  if (decision.action === "ignore") {
    logJson({ event: "line.event", type: decision.type, action: "ignored" });
    return;
  }

  if (decision.action === "drop") {
    logJson({
      event: "line.event",
      type: "message",
      sourceType: decision.sourceType,
      lineUserId: decision.lineUserId,
      action: "ignored",
      reason: decision.reason,
    });
    return;
  }

  try {
    const userId = await findUserIdByLineUserId(
      createDb(env.DB),
      decision.lineUserId,
    );
    if (!userId) {
      logJson({
        event: "line.event",
        type: "message",
        sourceType: "user",
        lineUserId: decision.lineUserId,
        action: "unregistered",
      });
      return;
    }

    if (decision.unsupported) {
      logJson({
        event: "line.event",
        type: "message",
        messageType: decision.messageType,
        action: "unsupported",
      });
      await replyIfPossible(env, decision.replyToken, "unsupported");
      return;
    }

    if (!decision.messageId || !decision.classify) {
      logJson({
        event: "line.event",
        type: "message",
        action: "save_failed",
      });
      await replyIfPossible(env, decision.replyToken, "save_failed");
      return;
    }

    const classified = classify(decision.classify);
    if (!classified.save) {
      logJson({
        event: "line.event",
        type: "message",
        messageType: decision.messageType,
        action: classified.reason,
      });
      await replyIfPossible(env, decision.replyToken, classified.reason);
      return;
    }

    const persisted = await createFromLine(env, {
      userId,
      lineMessageId: decision.messageId,
      classified,
    });
    if (persisted.status === "failed") {
      logJson({
        event: "line.event",
        type: "message",
        messageType: decision.messageType,
        action: "save_failed",
      });
      await replyIfPossible(env, decision.replyToken, "save_failed");
      return;
    }

    logJson({
      event: "line.event",
      type: "message",
      messageType: decision.messageType,
      action: persisted.status,
    });
  } catch {
    logJson({
      event: "line.event",
      type: "message",
      action: "save_failed",
    });
    await replyIfPossible(env, decision.replyToken, "save_failed");
  }
}

export async function processWebhook(
  env: Env,
  rawBody: ArrayBuffer,
): Promise<void> {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(rawBody));
    const record = asRecord(parsed);
    const events = record?.events;
    if (!Array.isArray(events) || events.length === 0) {
      logJson({ event: "line.webhook", type: "empty", action: "ignored" });
      return;
    }
    await Promise.allSettled(events.map((event) => handleEvent(env, event)));
  } catch {
    logJson({ event: "line.webhook", status: "invalid_json" });
  }
}
