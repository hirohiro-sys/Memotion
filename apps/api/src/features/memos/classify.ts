import type { MemoMediaType } from "@repo/shared";

export const IMAGE_CONTENT = "（画像）";

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
    "この形式は保存できません。テキスト（URL含む）か画像を送信してください。",
  empty: "本文が空です。テキスト（URL含む）か画像を送ってください。",
  save_failed: "保存できませんでした。もう一度送ってください。",
} as const satisfies Record<LineFailReason, string>;

export function replyTextFor(reason: LineFailReason): string {
  return REPLY_TEXT[reason];
}

const URL_PATTERN = /^https?:\/\/\S+$/i;

export function detectMediaType(text: string): Exclude<MemoMediaType, "image"> {
  return URL_PATTERN.test(text) ? "url" : "text";
}

// タグは Web で付け直すので、LINE からは常に tweet で保存し、本文の #tag は解釈しない。
export function classify(input: {
  text?: string | null;
  isImage?: boolean;
}): ClassifyResult {
  if (input.isImage) {
    return {
      save: true,
      tag: "tweet",
      mediaType: "image",
      content: IMAGE_CONTENT,
    };
  }

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
