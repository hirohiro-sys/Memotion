import { MAX_DAILY_REPORT_BODY } from "@repo/shared";

// モデル出力の空白だけを空とみなす。保存前の本文とは別。
export function isModelTextEmpty(modelText: string): boolean {
  return modelText.trim() === "";
}

// つなぎ目の改行だけを除き、間に空行を1つ置く。本文の途中の改行は残す。
export function joinBody(current: string, addition: string): string {
  const left = current.replace(/\n+$/, "");
  const right = addition.replace(/^\n+/, "");
  return `${left}\n\n${right}`;
}

// 文字数は UTF-16 の String.length。先頭行を含めた保存後の本文に使う。
export function bodyWithinLimit(body: string): boolean {
  return body.length <= MAX_DAILY_REPORT_BODY;
}

// モデルが書くのは本文だけ。先頭行はサーバーが1行目に足す。
export function withHeading(heading: string, modelText: string): string {
  return `${heading}\n${modelText}`;
}
