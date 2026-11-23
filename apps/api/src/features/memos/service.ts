import { type CreateMemoRequest, type Memo, memoSchema } from "@repo/shared";
import { nanoid } from "nanoid";
import type { Env } from "../../env";
import { createPage, queryDataSource } from "../../lib/notion/client";
import type { ClassifySuccess } from "./classify";
import { detectMediaType } from "./classify";
import type { WebMemoRecord } from "./dedup-record";
import {
  findWebMemo,
  hasLineMessage,
  putLineMessage,
  putWebMemo,
} from "./dedup-repository";
import { decideResend } from "./idempotency";
import { buildNotionPage, type NotionMemo } from "./notion-page";
import {
  memoIdQueryBody,
  type NotionListedMemo,
  scheduleQueryBody,
  techQueryBody,
  todoQueryBody,
  toNotionListedMemo,
} from "./notion-query";
import { resolveCreatedAt } from "./resolve-created-at";
import { validateCreateSchedule } from "./schedule";

type NotionEnv = Pick<Env, "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID">;

export type PersistResult =
  | { status: "inserted" }
  | { status: "duplicate" }
  | { status: "failed"; reason: "save_failed" };

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

export function toMemoResponse(memo: NotionMemo): Memo {
  return memoSchema.parse({
    id: memo.id,
    tag: memo.tag,
    content: memo.content,
    mediaType: memo.mediaType,
    source: memo.source,
    createdAt: memo.createdAt,
    ...(memo.tag === "schedule" && memo.scheduledDate
      ? { scheduledDate: memo.scheduledDate }
      : {}),
    ...(memo.tag === "schedule" && memo.scheduledDate && memo.scheduledTime
      ? { scheduledTime: memo.scheduledTime }
      : {}),
  });
}

function recordToMemo(record: WebMemoRecord): NotionMemo {
  return {
    id: record.id,
    tag: record.tag,
    content: record.content,
    mediaType: record.mediaType,
    source: record.source,
    createdAt: record.createdAt,
    ...(record.scheduledDate ? { scheduledDate: record.scheduledDate } : {}),
    ...(record.scheduledTime ? { scheduledTime: record.scheduledTime } : {}),
  };
}

// 同じメモIDのページが Notion にあるか。読めなければ null。
async function findNotionPage(
  env: NotionEnv & { NOTION_TOKEN: string; NOTION_DATA_SOURCE_ID: string },
  memoId: string,
): Promise<boolean | null> {
  const result = await queryDataSource({
    token: env.NOTION_TOKEN,
    dataSourceId: env.NOTION_DATA_SOURCE_ID,
    body: memoIdQueryBody(memoId),
  });
  return result.ok ? result.results.length > 0 : null;
}

// 書き込みの結果が分からない失敗（ネットワーク、5xx）。Notion は 503 でも保存していることがある。
function isAmbiguousFailure(status: number): boolean {
  return status === 0 || status >= 500;
}

export type NotionSaveResult = { ok: true; created: boolean } | { ok: false };

// メモを Notion のページにする。メモの保存先は Notion だけ。
// checkFirst のときは、先に同じメモIDのページを探し、あれば作らない（Web の再送）。
// 結果が分からない失敗のあとも、メモIDで探して保存済みかを確かめる。
export async function saveMemoToNotion(
  env: NotionEnv,
  memo: NotionMemo,
  options: { checkFirst: boolean },
): Promise<NotionSaveResult> {
  const { NOTION_TOKEN, NOTION_DATA_SOURCE_ID } = env;
  if (!NOTION_TOKEN || !NOTION_DATA_SOURCE_ID) {
    logJson({
      event: "memo.notion",
      status: "skipped",
      reason: "no_secret",
      memoId: memo.id,
    });
    return { ok: false };
  }
  const secrets = { NOTION_TOKEN, NOTION_DATA_SOURCE_ID };

  if (options.checkFirst && (await findNotionPage(secrets, memo.id))) {
    logJson({ event: "memo.notion", status: "duplicate", memoId: memo.id });
    return { ok: true, created: false };
  }

  const result = await createPage({
    token: NOTION_TOKEN,
    body: buildNotionPage(memo, NOTION_DATA_SOURCE_ID),
  });
  if (result.ok) return { ok: true, created: true };

  if (
    isAmbiguousFailure(result.status) &&
    (await findNotionPage(secrets, memo.id))
  ) {
    return { ok: true, created: true };
  }
  logJson({
    event: "memo.notion",
    status: "failed",
    httpStatus: result.status,
    memoId: memo.id,
  });
  return { ok: false };
}

export async function createForUser(
  env: Pick<Env, "DEDUP"> & NotionEnv,
  userId: string,
  input: CreateMemoRequest,
): Promise<
  | { ok: true; memo: Memo; created: boolean }
  | { ok: false; error: "save_failed" | "conflict" | "past_date" }
> {
  const now = new Date();
  if (validateCreateSchedule(input, now) === "past_date") {
    return { ok: false, error: "past_date" };
  }

  // 端末が付けた id の再送は、先に KV の記録で見分ける。
  if (input.id !== undefined) {
    const recorded = await readWebMemoRecord(env.DEDUP, input.id);
    if (recorded) {
      const decision = decideResend(recorded, input, userId);
      if (decision.kind === "existing") {
        logJson({
          event: "memo.create",
          status: "duplicate",
          memoId: input.id,
        });
        return {
          ok: true,
          created: false,
          memo: toMemoResponse(recordToMemo(decision.record)),
        };
      }
      logJson({ event: "memo.create", status: "conflict", memoId: input.id });
      return { ok: false, error: "conflict" };
    }
  }

  const memo: NotionMemo = {
    id: input.id ?? nanoid(),
    tag: input.tag,
    content: input.content,
    mediaType: detectMediaType(input.content),
    source: "web",
    createdAt: resolveCreatedAt(input.createdAt, now),
    ...(input.tag === "schedule" && input.scheduledDate
      ? { scheduledDate: input.scheduledDate }
      : {}),
    ...(input.tag === "schedule" && input.scheduledDate && input.scheduledTime
      ? { scheduledTime: input.scheduledTime }
      : {}),
  };

  // KV の記録が無い再送（記録の書き込みの失敗、30 日の期限切れ）は、Notion をメモIDで探して見分ける。
  const saved = await saveMemoToNotion(env, memo, {
    checkFirst: input.id !== undefined,
  });
  if (!saved.ok) return { ok: false, error: "save_failed" };

  if (input.id !== undefined) {
    await recordWebMemo(env.DEDUP, {
      ...memo,
      userId,
      scheduledDate: memo.scheduledDate ?? null,
      scheduledTime: memo.scheduledTime ?? null,
    });
  }
  return { ok: true, created: saved.created, memo: toMemoResponse(memo) };
}

export async function createFromLine(
  env: Pick<Env, "DEDUP"> & NotionEnv,
  input: {
    lineMessageId: string;
    classified: ClassifySuccess;
  },
): Promise<PersistResult> {
  try {
    if (await isRecordedLineMessage(env.DEDUP, input.lineMessageId)) {
      return { status: "duplicate" };
    }

    const memo: NotionMemo = {
      id: nanoid(),
      tag: input.classified.tag,
      content: input.classified.content,
      mediaType: input.classified.mediaType,
      source: "line",
      createdAt: new Date().toISOString(),
    };
    const saved = await saveMemoToNotion(env, memo, { checkFirst: false });
    if (!saved.ok) return { status: "failed", reason: "save_failed" };

    await recordLineMessage(env.DEDUP, input.lineMessageId, memo.id);
    return { status: "inserted" };
  } catch {
    return { status: "failed", reason: "save_failed" };
  }
}

// 通知用に Notion からメモを読む。1回の通知で読むのは最大 5 ページ（500 件）まで。
const NOTION_MAX_PAGES = 5;

// truncated は、読める上限で打ち切ったとき true。
export type NotionMemoList =
  | { ok: true; memos: NotionListedMemo[]; truncated: boolean }
  | { ok: false; reason: "no_secret" }
  | { ok: false; reason: "upstream"; httpStatus: number };

async function queryNotionMemos(
  env: NotionEnv,
  bodyFor: (cursor?: string) => unknown,
): Promise<NotionMemoList> {
  if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) {
    return { ok: false, reason: "no_secret" };
  }
  const memos: NotionListedMemo[] = [];
  let cursor: string | undefined;
  let truncated = false;
  for (let page = 0; page < NOTION_MAX_PAGES; page += 1) {
    const result = await queryDataSource({
      token: env.NOTION_TOKEN,
      dataSourceId: env.NOTION_DATA_SOURCE_ID,
      body: bodyFor(cursor),
    });
    if (!result.ok) {
      return { ok: false, reason: "upstream", httpStatus: result.status };
    }
    for (const item of result.results) {
      const memo = toNotionListedMemo(item);
      if (memo) memos.push(memo);
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
    truncated = page === NOTION_MAX_PAGES - 1;
  }
  return { ok: true, memos, truncated };
}

// 記録日時が窓の中の tech。窓の境界はここで正確に絞る。
export async function listTechMemosFromNotion(
  env: NotionEnv,
  window: { start: Date; end: Date },
): Promise<NotionMemoList> {
  const listed = await queryNotionMemos(env, (cursor) =>
    techQueryBody(window, cursor),
  );
  if (!listed.ok) return listed;
  return {
    ...listed,
    memos: listed.memos.filter((memo) => {
      const ms = Date.parse(memo.createdAt);
      return ms >= window.start.getTime() && ms < window.end.getTime();
    }),
  };
}

// 種類が todo のページすべて。完了したものは Notion で消すか種類を変える。
export async function listTodoMemosFromNotion(
  env: NotionEnv,
): Promise<NotionMemoList> {
  return queryNotionMemos(env, (cursor) => todoQueryBody(cursor));
}

// 予定日時の JST の日付が date の予定。
export async function listSchedulesFromNotion(
  env: NotionEnv,
  date: string,
): Promise<NotionMemoList> {
  const listed = await queryNotionMemos(env, (cursor) =>
    scheduleQueryBody(date, cursor),
  );
  if (!listed.ok) return listed;
  return {
    ...listed,
    memos: listed.memos.filter((memo) => memo.scheduledDate === date),
  };
}

// KV の記録の読み書きは、失敗しても保存を止めない。記録が無いときは Notion をメモIDで探すため。
// 失敗はログに残し、記録なしとして進む。
async function readWebMemoRecord(
  kv: KVNamespace,
  memoId: string,
): Promise<WebMemoRecord | null> {
  try {
    return await findWebMemo(kv, memoId);
  } catch {
    logJson({ event: "memo.dedup", status: "failed", reason: "read", memoId });
    return null;
  }
}

async function recordWebMemo(
  kv: KVNamespace,
  record: WebMemoRecord,
): Promise<void> {
  try {
    await putWebMemo(kv, record);
  } catch {
    logJson({
      event: "memo.dedup",
      status: "failed",
      reason: "write",
      memoId: record.id,
    });
  }
}

async function isRecordedLineMessage(
  kv: KVNamespace,
  lineMessageId: string,
): Promise<boolean> {
  try {
    return await hasLineMessage(kv, lineMessageId);
  } catch {
    logJson({ event: "memo.dedup", status: "failed", reason: "read" });
    return false;
  }
}

async function recordLineMessage(
  kv: KVNamespace,
  lineMessageId: string,
  memoId: string,
): Promise<void> {
  try {
    await putLineMessage(kv, lineMessageId, memoId);
  } catch {
    logJson({ event: "memo.dedup", status: "failed", reason: "write", memoId });
  }
}
