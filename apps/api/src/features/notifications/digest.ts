import type { PushResult } from "../../lib/line/client";
import {
  buildDigestMessages,
  buildTodoDigestMessages,
  type DigestMemo,
} from "./message";
import {
  type DailySlot,
  type DigestWindow,
  isDueToSend,
  latestDueAt,
  type WeeklySlot,
  windowEndingAt,
} from "./window";

// 送信済みの記録が無いとき（初回、KV が空）は送らず、今を送信済みとして記録する（baseline）。
// 記録を移した直後のデプロイで、すでに送った分を送り直さないため。
export type TechWeeklyDecision =
  | { action: "baseline" }
  | { action: "not_due" }
  | { action: "due"; window: DigestWindow };

export type TodoDailyDecision =
  | { action: "baseline" }
  | { action: "not_due" }
  | { action: "due" };

export function decideTechWeekly(input: {
  slot: WeeklySlot;
  now: Date;
  lastSentAt: string | null;
}): TechWeeklyDecision {
  if (input.lastSentAt === null) return { action: "baseline" };
  if (!isDueToSend(input.now, input.slot, input.lastSentAt)) {
    return { action: "not_due" };
  }
  return {
    action: "due",
    window: windowEndingAt(latestDueAt(input.now, input.slot)),
  };
}

export function decideTodoDaily(input: {
  slot: DailySlot;
  now: Date;
  lastSentAt: string | null;
}): TodoDailyDecision {
  if (input.lastSentAt === null) return { action: "baseline" };
  return isDueToSend(input.now, input.slot, input.lastSentAt)
    ? { action: "due" }
    : { action: "not_due" };
}

export function buildTechWeeklyTexts(input: {
  memos: DigestMemo[];
  window: DigestWindow;
  linkUrl: string;
}): string[] {
  return buildDigestMessages({
    memos: input.memos,
    windowStart: input.window.start,
    windowEnd: input.window.end,
    appUrl: input.linkUrl,
  });
}

export function buildTodoDailyTexts(input: {
  memos: DigestMemo[];
  linkUrl: string;
}): string[] {
  return buildTodoDigestMessages({
    memos: input.memos,
    appUrl: input.linkUrl,
  });
}

// 送信のあと、その回を送信済みとして記録するか。
// 一時的な失敗だけは記録せず、次の分に送り直す。届かない（ブロックなど）ときは記録し、毎分送り直さない。
export function shouldRecordAfterPush(result: PushResult): boolean {
  return result !== "transient";
}
