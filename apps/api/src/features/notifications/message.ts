import { formatDateMd, formatJstMd, formatJstMdHm } from "./jst";

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

function memoBody(memo: DigestMemo): string {
  return isUrlMemo(memo)
    ? (memo.url ?? memo.content)
    : excerptText(memo.content);
}

function formatMemoLine(memo: DigestMemo): string {
  return `${formatJstMd(new Date(memo.createdAt))} ${memoBody(memo)}`;
}

function byCreatedAt(a: DigestMemo, b: DigestMemo): number {
  return a.createdAt.localeCompare(b.createdAt);
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

// 並べ替えと1行の整形は呼び出し側が渡す。
function packDigestMessages<T extends DigestMemo>(
  memos: T[],
  title: string,
  appUrl: string,
  format: { compare: (a: T, b: T) => number; line: (memo: T) => string },
): string[] {
  if (memos.length === 0) return [];

  const sorted = [...memos].sort(format.compare);
  const items: DigestLine[] = sorted.map((memo) => ({
    text: format.line(memo),
    previewCount: isUrlMemo(memo) ? 1 : 0,
  }));
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
    { compare: byCreatedAt, line: formatMemoLine },
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
    { compare: byCreatedAt, line: formatMemoLine },
  );
}

export type ScheduleDigestMemo = DigestMemo & { scheduledTime: string | null };

// 時刻のない予定が先頭。残りは時刻の早い順。同じ時刻は登録順。
function bySchedule(a: ScheduleDigestMemo, b: ScheduleDigestMemo): number {
  if (a.scheduledTime !== b.scheduledTime) {
    if (a.scheduledTime === null) return -1;
    if (b.scheduledTime === null) return 1;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  }
  return byCreatedAt(a, b);
}

function formatScheduleLine(memo: ScheduleDigestMemo): string {
  return `${memo.scheduledTime ?? "時間未定"} ${memoBody(memo)}`;
}

export function buildScheduleDigestMessages(input: {
  schedules: ScheduleDigestMemo[];
  targetDate: string;
  appUrl: string;
}): string[] {
  return packDigestMessages(
    input.schedules,
    `明日の予定 ${input.schedules.length}件（${formatDateMd(input.targetDate)}）`,
    input.appUrl,
    { compare: bySchedule, line: formatScheduleLine },
  );
}
