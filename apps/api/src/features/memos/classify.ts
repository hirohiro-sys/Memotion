import type { MemoMediaType, MemoTag } from "@repo/shared";

export const IMAGE_CONTENT = "（画像）";

export type LineFailReason =
  | "unsupported"
  | "unknown_tag"
  | "empty_after_tag"
  | "empty"
  | "save_failed";

export type ClassifySuccess = {
  save: true;
  tag: MemoTag;
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
  unknown_tag: "使えるタグは #tweet #tech #other です。",
  empty_after_tag:
    "本文が空です。タグのあとにテキスト（URL含む）か画像を送ってください。",
  empty: "本文が空です。テキスト（URL含む）か画像を送ってください。",
  save_failed: "保存できませんでした。もう一度送ってください。",
} as const satisfies Record<LineFailReason, string>;

export function replyTextFor(reason: LineFailReason): string {
  return REPLY_TEXT[reason];
}

const URL_PATTERN = /^https?:\/\/\S+$/i;
const LEADING_PERMITTED_TAG = /^(?:[#＃])(tweet|tech|other)(?![0-9A-Za-z])/i;
const LEADING_HASH = /^[#＃]/;

export function detectMediaType(text: string): Exclude<MemoMediaType, "image"> {
  return URL_PATTERN.test(text) ? "url" : "text";
}

function leadingPermittedTag(
  text: string,
): { tag: MemoTag; rest: string } | null {
  const match = LEADING_PERMITTED_TAG.exec(text);
  if (!match?.[1]) return null;
  return {
    tag: match[1].toLowerCase() as MemoTag,
    rest: text.slice(match[0].length).trim(),
  };
}

export function classify(input: {
  text?: string | null;
  isImage?: boolean;
}): ClassifyResult {
  if (input.isImage) {
    return {
      save: true,
      tag: "other",
      mediaType: "image",
      content: IMAGE_CONTENT,
    };
  }

  const text = input.text?.trim() ?? "";
  if (text.length === 0) {
    return { save: false, reason: "empty" };
  }

  const leading = leadingPermittedTag(text);
  if (leading) {
    if (leadingPermittedTag(leading.rest)) {
      return { save: false, reason: "unknown_tag" };
    }
    if (leading.rest.length === 0) {
      return { save: false, reason: "empty_after_tag" };
    }
    return {
      save: true,
      tag: leading.tag,
      mediaType: detectMediaType(leading.rest),
      content: leading.rest,
    };
  }

  if (LEADING_HASH.test(text)) {
    return { save: false, reason: "unknown_tag" };
  }

  const mediaType = detectMediaType(text);
  return {
    save: true,
    tag: mediaType === "url" ? "tech" : "tweet",
    mediaType,
    content: text,
  };
}
