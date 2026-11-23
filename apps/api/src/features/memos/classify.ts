import type { MemoMediaType } from "@repo/shared";

export type LineFailReason = "unsupported" | "empty" | "save_failed";

export type ClassifySuccess = {
  save: true;
  tag: "tweet";
  mediaType: MemoMediaType;
  content: string;
};

export type ClassifyFailure = {
  save: false;
  reason: LineFailReason;
};

export type ClassifyResult = ClassifySuccess | ClassifyFailure;

export const REPLY_TEXT = {
  unsupported:
    "この形式は保存できません。テキスト（URL含む）を送信してください。",
  empty: "本文が空です。テキスト（URL含む）を送ってください。",
  save_failed: "保存できませんでした。もう一度送ってください。",
} as const satisfies Record<LineFailReason, string>;

export function replyTextFor(reason: LineFailReason): string {
  return REPLY_TEXT[reason];
}

const URL_PATTERN = /^https?:\/\/\S+$/i;

export function detectMediaType(text: string): MemoMediaType {
  return URL_PATTERN.test(text) ? "url" : "text";
}

// LINE では分類しない。本文の #tag も解釈せず、常に tweet で保存する。
// 画像などテキスト以外のメッセージは、ここに来る前に unsupported にする。
export function classify(input: { text?: string | null }): ClassifyResult {
  const text = input.text?.trim() ?? "";
  if (text.length === 0) {
    return { save: false, reason: "empty" };
  }

  return {
    save: true,
    tag: "tweet",
    mediaType: detectMediaType(text),
    content: text,
  };
}
