import { type CreateMemoRequest, type Memo, memoSchema } from "@repo/shared";
import { nanoid } from "nanoid";
import type { Env } from "../../env";
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
import type { NotionMemo } from "./notion-page";
import {
  scheduleQueryBody,
  techQueryBody,
  todoQueryBody,
} from "./notion-query";
import {
  type NotionEnv,
  type NotionMemoList,
  queryNotionMemos,
  saveMemoToNotion,
} from "./notion-repository";
import { resolveCreatedAt } from "./resolve-created-at";
import { scheduleFields, validateCreateSchedule } from "./schedule";

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
    ...scheduleFields(memo),
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
    ...scheduleFields(record),
  };
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
    ...scheduleFields(input),
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

// 通知用に Notion からメモを読む。読む件数の上限は notion-repository が決める。
export type { NotionMemoList };

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
