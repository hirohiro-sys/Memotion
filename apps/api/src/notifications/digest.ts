import type { PushResult } from "../line/client";
import { buildDigestMessages, type DigestMemo } from "./message";
import { type StoredSettings, UNREACHABLE_DISABLED_REASON } from "./settings";
import {
  type DigestWindow,
  isDueToSend,
  isInstantInWindow,
  latestDueAt,
  windowEndingAt,
} from "./window";

export type DigestDecision =
  | { action: "skip"; reason: "disabled" | "not_due" | "empty" }
  | { action: "push"; texts: string[]; window: DigestWindow };

export function decideUserDigest(input: {
  settings: StoredSettings;
  now: Date;
  memos: DigestMemo[];
  appUrl: string;
}): DigestDecision {
  if (!input.settings.enabled) {
    return { action: "skip", reason: "disabled" };
  }

  const slot = {
    weekday: input.settings.weekday,
    time: input.settings.time,
  };
  if (!isDueToSend(input.now, slot, input.settings.lastSentAt)) {
    return { action: "skip", reason: "not_due" };
  }

  const window = windowEndingAt(latestDueAt(input.now, slot));
  const inWindow = input.memos.filter((memo) =>
    isInstantInWindow(memo.createdAt, window),
  );
  if (inWindow.length === 0) {
    return { action: "skip", reason: "empty" };
  }

  const texts = buildDigestMessages({
    memos: inWindow,
    windowStart: window.start,
    windowEnd: window.end,
    appUrl: input.appUrl,
  });
  if (texts.length === 0) {
    return { action: "skip", reason: "empty" };
  }

  return { action: "push", texts, window };
}

export function settingsAfterPush(
  settings: StoredSettings,
  result: PushResult,
  now: Date,
): StoredSettings | null {
  if (result === "success") {
    return { ...settings, lastSentAt: now.toISOString() };
  }
  if (result === "unreachable") {
    return {
      ...settings,
      enabled: false,
      disabledReason: UNREACHABLE_DISABLED_REASON,
    };
  }
  return null;
}
