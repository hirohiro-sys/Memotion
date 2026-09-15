import { formatJstMd, formatJstMdHm } from "./jst";

export const MAX_DIGEST_MESSAGES = 5;
export const DIGEST_TEXT_LIMIT = 5000;
export const TEXT_EXCERPT_LENGTH = 200;

export type DigestMemo = {
  createdAt: string;
  content: string;
  mediaType: string;
  url?: string | null;
};

function isUrlMemo(memo: DigestMemo): boolean {
  return memo.mediaType === "url" || Boolean(memo.url);
}

function excerptText(content: string): string {
  return content.slice(0, TEXT_EXCERPT_LENGTH);
}

function formatMemoLine(memo: DigestMemo): string {
  const date = formatJstMd(new Date(memo.createdAt));
  const body = isUrlMemo(memo) ? (memo.url ?? memo.content) : excerptText(memo.content);
  return `${date} ${body}`;
}

function headline(count: number, start: Date, end: Date): string {
  return `今週のTech ${count}件（${formatJstMdHm(start)} 〜 ${formatJstMdHm(end)}）`;
}

function overflowFooter(count: number, appUrl: string): string {
  return `他${count}件は Web で\n${appUrl}`;
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

function fits(lines: string[], extra: string): boolean {
  return joinLines([...lines, extra]).length <= DIGEST_TEXT_LIMIT;
}

export function buildDigestMessages(input: {
  memos: DigestMemo[];
  windowStart: Date;
  windowEnd: Date;
  appUrl: string;
}): string[] {
  if (input.memos.length === 0) return [];

  const sorted = [...input.memos].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const itemLines = sorted.map(formatMemoLine);
  const head = headline(sorted.length, input.windowStart, input.windowEnd);
  const messages: string[][] = [[head]];
  let packed = 0;

  for (const line of itemLines) {
    const last = messages[messages.length - 1];
    if (last && fits(last, line)) {
      last.push(line);
      packed += 1;
      continue;
    }
    if (messages.length >= MAX_DIGEST_MESSAGES || line.length > DIGEST_TEXT_LIMIT) {
      break;
    }
    messages.push([line]);
    packed += 1;
  }

  const leftover = itemLines.length - packed;
  if (leftover === 0) {
    return messages.map(joinLines);
  }

  let remaining = leftover;
  const last = messages[messages.length - 1];
  if (!last) return messages.map(joinLines);

  while (!fits(last, overflowFooter(remaining, input.appUrl))) {
    if (last.length <= 1) {
      if (messages.length < MAX_DIGEST_MESSAGES) {
        messages.push([overflowFooter(remaining, input.appUrl)]);
        return messages.map(joinLines);
      }
      break;
    }
    last.pop();
    remaining += 1;
  }

  last.push(overflowFooter(remaining, input.appUrl));
  return messages.map(joinLines);
}
