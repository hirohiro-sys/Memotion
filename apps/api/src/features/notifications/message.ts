import { formatJstMd, formatJstMdHm } from "./jst";

export const MAX_DIGEST_MESSAGES = 5;
export const MAX_URL_PREVIEWS_PER_MESSAGE = 5;
export const DIGEST_TEXT_LIMIT = 5000;
export const TEXT_EXCERPT_LENGTH = 200;

export type DigestMemo = {
  createdAt: string;
  content: string;
  mediaType: string;
  url?: string | null;
};

type DigestLine = {
  text: string;
  previewCount: number;
};

function isUrlMemo(memo: DigestMemo): boolean {
  return memo.mediaType === "url" || Boolean(memo.url);
}

function excerptText(content: string): string {
  return content.slice(0, TEXT_EXCERPT_LENGTH);
}

function formatMemoLine(memo: DigestMemo): string {
  const date = formatJstMd(new Date(memo.createdAt));
  const body = isUrlMemo(memo)
    ? (memo.url ?? memo.content)
    : excerptText(memo.content);
  return `${date} ${body}`;
}

function formatMemoEntry(memo: DigestMemo): DigestLine {
  return {
    text: formatMemoLine(memo),
    previewCount: isUrlMemo(memo) ? 1 : 0,
  };
}

function headline(count: number, start: Date, end: Date): string {
  return `今週のTech ${count}件（${formatJstMdHm(start)} 〜 ${formatJstMdHm(end)}）`;
}

function overflowFooter(count: number, appUrl: string): DigestLine {
  return {
    text: `他${count}件は Web で\n${appUrl}`,
    previewCount: 1,
  };
}

function joinLineTexts(lines: DigestLine[]): string {
  return lines.map((line) => line.text).join("\n");
}

function previewCountOf(lines: DigestLine[]): number {
  return lines.reduce((sum, line) => sum + line.previewCount, 0);
}

function canAppend(lines: DigestLine[], extra: DigestLine): boolean {
  const next = joinLineTexts([...lines, extra]);
  return (
    next.length <= DIGEST_TEXT_LIMIT &&
    previewCountOf(lines) + extra.previewCount <= MAX_URL_PREVIEWS_PER_MESSAGE
  );
}

function packDigestMessages(
  memos: DigestMemo[],
  title: string,
  appUrl: string,
): string[] {
  if (memos.length === 0) return [];

  const sorted = [...memos].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const items = sorted.map(formatMemoEntry);
  const messages: DigestLine[][] = [[{ text: title, previewCount: 0 }]];
  let packed = 0;

  for (const item of items) {
    const last = messages[messages.length - 1];
    if (last && canAppend(last, item)) {
      last.push(item);
      packed += 1;
      continue;
    }
    if (
      messages.length >= MAX_DIGEST_MESSAGES ||
      item.text.length > DIGEST_TEXT_LIMIT
    ) {
      break;
    }
    messages.push([item]);
    packed += 1;
  }

  const leftover = items.length - packed;
  if (leftover === 0) {
    return messages.map(joinLineTexts);
  }

  let remaining = leftover;
  const last = messages[messages.length - 1];
  if (!last) return messages.map(joinLineTexts);

  while (!canAppend(last, overflowFooter(remaining, appUrl))) {
    if (last.length <= 1) {
      if (messages.length < MAX_DIGEST_MESSAGES) {
        messages.push([overflowFooter(remaining, appUrl)]);
        return messages.map(joinLineTexts);
      }
      break;
    }
    last.pop();
    remaining += 1;
  }

  last.push(overflowFooter(remaining, appUrl));
  return messages.map(joinLineTexts);
}

export function buildDigestMessages(input: {
  memos: DigestMemo[];
  windowStart: Date;
  windowEnd: Date;
  appUrl: string;
}): string[] {
  return packDigestMessages(
    input.memos,
    headline(input.memos.length, input.windowStart, input.windowEnd),
    input.appUrl,
  );
}

export function buildTodoDigestMessages(input: {
  memos: DigestMemo[];
  appUrl: string;
}): string[] {
  return packDigestMessages(
    input.memos,
    `未完了のTODO ${input.memos.length}件`,
    input.appUrl,
  );
}
