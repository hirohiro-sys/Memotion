import {
  type ChangeMemoTagRequest,
  type CreateMemoRequest,
  type Memo,
  memoListResponseSchema,
  memoSchema,
  type SetScheduleRequest,
} from "@repo/shared";
import { nanoid } from "nanoid";
import { createDb, type Database } from "../../db";
import type { Env } from "../../env";
import { fetchMessageContent } from "../../lib/line/client";
import { createPage, queryDataSource } from "../../lib/notion/client";
import type { ClassifySuccess } from "./classify";
import { detectMediaType } from "./classify";
import {
  isForeignKeyViolation,
  isLineMessageIdConflict,
} from "./constraint-error";
import { toWebMemoRecord } from "./dedup-record";
import {
  findWebMemo,
  hasLineMessage,
  putLineMessage,
  putWebMemo,
} from "./dedup-repository";
import {
  decideCreateResult,
  type ExistingMemoRow,
  isPrimaryKeyConflict,
  type SaveResult,
} from "./idempotency";
import { buildNotionPage, type NotionMemo } from "./notion-page";
import {
  type NotionListedMemo,
  scheduleQueryBody,
  techQueryBody,
  todoQueryBody,
  toNotionListedMemo,
} from "./notion-query";
import { fetchOgpImage, isHttpsUrl } from "./ogp";
import {
  assignMemosToGroup,
  claimOgp,
  countMemosByGroup,
  deleteMedia,
  deleteMemosByIds,
  deleteMemosInGroupStatement,
  findByLineMessageId,
  findMemoForUser,
  findMemoMedia,
  findMemoWithOwner,
  findOwnedMemosByIds,
  findTagBySlug,
  getMedia,
  insertMemo,
  listClaimableOgpIds,
  listMemos,
  type MemoRow,
  memoImageKey,
  type OgpState,
  type OgpTarget,
  putMedia,
  updateMemoOgp,
  updateMemoSchedule,
  updateMemoTag,
} from "./repository";
import { resolveCreatedAt } from "./resolve-created-at";
import {
  decideScheduleSet,
  isPastScheduleDate,
  validateCreateSchedule,
} from "./schedule";
import { decideTagChange } from "./tag-change";

const OGP_CLAIM_STALE_MS = 30_000;
const OGP_BACKFILL_BUDGET_MS = 20_000;

export type PersistResult =
  | { status: "inserted" }
  | { status: "duplicate" }
  | { status: "failed"; reason: "save_failed" };

export function toMemoResponse(row: MemoRow): Memo {
  return memoSchema.parse({
    id: row.id,
    tag: row.tag,
    content: row.content,
    mediaType: row.mediaType,
    source: row.source,
    createdAt: row.createdAt,
    ...(row.url ? { url: row.url } : {}),
    ...(row.mediaType === "image" || (row.mediaType === "url" && row.imageKey)
      ? { thumbnailUrl: `/api/memos/${row.id}/image` }
      : {}),
    ...(row.tag === "schedule" && row.scheduledDate
      ? { scheduledDate: row.scheduledDate }
      : {}),
    ...(row.tag === "schedule" && row.scheduledDate && row.scheduledTime
      ? { scheduledTime: row.scheduledTime }
      : {}),
  });
}

export type OwnedMemo = {
  id: string;
  tag: string;
  content: string;
  url: string | null;
  createdAt: string;
  groupId: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

// 画像キーは返さない。日報の材料にしないため。
export async function findOwnedByIds(
  db: Database,
  userId: string,
  ids: string[],
): Promise<OwnedMemo[]> {
  const rows = await findOwnedMemosByIds(db, userId, ids);
  return rows.map((row) => ({
    id: row.id,
    tag: row.tag,
    content: row.content,
    url: row.url,
    createdAt: row.createdAt,
    groupId: row.groupId,
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
  }));
}

// 既定ではどのグループにも入っていないメモだけを返す。groupId を渡すとそのグループのメモだけを返す。
// groupId の持ち主の確認は呼び出し側（groups の service）が行う。
export async function listForUser(
  db: Database,
  userId: string,
  options: { groupId?: string } = {},
) {
  const rows = await listMemos(db, userId, options.groupId ?? null);
  return memoListResponseSchema.parse({ items: rows.map(toMemoResponse) });
}

export async function createForUser(
  db: Database,
  kv: KVNamespace,
  userId: string,
  input: CreateMemoRequest,
  options: { groupId?: string } = {},
): Promise<
  | { ok: true; memo: Memo; created: boolean }
  | {
      ok: false;
      error:
        | "invalid"
        | "save_failed"
        | "conflict"
        | "group_missing"
        | "past_date";
    }
> {
  const { groupId } = options;
  const now = new Date();
  const scheduleCheck = validateCreateSchedule(
    { tag: input.tag, groupId, scheduledDate: input.scheduledDate },
    now,
  );
  if (scheduleCheck !== "ok") return { ok: false, error: scheduleCheck };

  const memoId = input.id ?? nanoid();
  const compared = {
    tag: input.tag,
    content: input.content,
    groupId,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
  };

  // 端末が付けた id の再送は、先に KV の記録で見分ける。
  // 記録が無いか読めないときは D1 に保存し、主キーの一意制約で見分ける（#143 まで残す保険）。
  if (input.id !== undefined) {
    const recorded = await readWebMemoRecord(kv, memoId);
    if (recorded) {
      const decision = decideCreateResult(
        "primary_key_conflict",
        recorded,
        compared,
        userId,
      );
      if (decision.kind === "existing") {
        logJson({ event: "memo.create", status: "duplicate", memoId });
        return {
          ok: true,
          created: false,
          memo: toMemoResponse(decision.row),
        };
      }
      logJson({ event: "memo.create", status: "conflict", memoId });
      return { ok: false, error: "conflict" };
    }
  }

  const tag = await findTagBySlug(db, input.tag);
  if (!tag) return { ok: false, error: "invalid" };

  const createdAt = resolveCreatedAt(input.createdAt, now);
  const mediaType = detectMediaType(input.content);
  const scheduledDate =
    input.tag === "schedule" ? (input.scheduledDate ?? null) : null;
  const scheduledTime =
    input.tag === "schedule" ? (input.scheduledTime ?? null) : null;

  let saveResult: SaveResult = "inserted";
  let existing: ExistingMemoRow | null = null;
  try {
    await insertMemo(db, {
      id: memoId,
      userId,
      tagId: tag.id,
      content: input.content,
      url: null,
      imageKey: null,
      source: "web",
      mediaType,
      lineMessageId: null,
      createdAt,
      groupId: groupId ?? null,
      scheduledDate,
      scheduledTime,
    });
  } catch (error) {
    // error は SQL と本文を含むためログに渡さない。
    if (groupId !== undefined && isForeignKeyViolation(error)) {
      logJson({
        event: "memo.create",
        status: "group_missing",
        userId,
        memoId,
        groupId,
      });
      return { ok: false, error: "group_missing" };
    }
    saveResult = isPrimaryKeyConflict(error)
      ? "primary_key_conflict"
      : "failed";
    if (saveResult === "primary_key_conflict") {
      try {
        existing = await findMemoWithOwner(db, memoId);
      } catch {
        existing = null;
      }
    }
  }

  const decision = decideCreateResult(saveResult, existing, compared, userId);
  switch (decision.kind) {
    case "created": {
      const row: MemoRow = {
        id: memoId,
        tag: tag.slug,
        content: input.content,
        url: null,
        imageKey: null,
        mediaType,
        source: "web",
        createdAt,
        groupId: groupId ?? null,
        scheduledDate,
        scheduledTime,
      };
      if (input.id !== undefined) {
        await recordWebMemo(kv, toWebMemoRecord(row, userId));
      }
      return { ok: true, created: true, memo: toMemoResponse(row) };
    }
    case "existing":
      logJson({ event: "memo.create", status: "duplicate", memoId });
      return { ok: true, created: false, memo: toMemoResponse(decision.row) };
    case "conflict":
      logJson({ event: "memo.create", status: "conflict", memoId });
      return { ok: false, error: "conflict" };
    case "save_failed":
      return { ok: false, error: "save_failed" };
  }
}

// つぶやきを予定にする、または予定の日時を変える。
// 順番は「過去の日付（DB に触らない）→ メモの取得（持ち主で絞る）→ 状態の判断 → 条件付きの更新」。
export async function setScheduleForUser(
  db: Database,
  userId: string,
  memoId: string,
  input: SetScheduleRequest,
): Promise<
  | { ok: true; memo: Memo }
  | {
      ok: false;
      error: "past_date" | "not_found" | "not_schedulable" | "save_failed";
    }
> {
  if (isPastScheduleDate(input.scheduledDate, new Date())) {
    return { ok: false, error: "past_date" };
  }

  const memo = await findMemoForUser(db, userId, memoId);
  const decision = decideScheduleSet({ memo });
  if (decision !== "ok") return { ok: false, error: decision };

  const tag = await findTagBySlug(db, "schedule");
  if (!tag) return { ok: false, error: "save_failed" };

  let updated: MemoRow | null;
  try {
    updated = await updateMemoSchedule(db, {
      userId,
      memoId,
      scheduleTagId: tag.id,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime ?? null,
    });
  } catch {
    // 例外の message は SQL と params（日付や本文）を含むため、投げ直さず ID だけ残す。
    logJson({ event: "memo.schedule", status: "failed", userId, memoId });
    return { ok: false, error: "save_failed" };
  }
  if (updated) return { ok: true, memo: toMemoResponse(updated) };

  // 確認のあとに状態が変わった。削除されていれば 404、グループに入ったなどなら 409。
  const current = await findMemoForUser(db, userId, memoId);
  return { ok: false, error: current ? "not_schedulable" : "not_found" };
}

// 保存済みメモのタグを付け直す。
// 順番は「メモの取得（持ち主で絞る）→ 状態の判断 → 同じタグなら何もしない → 条件付きの更新」。
export async function changeTagForUser(
  db: Database,
  userId: string,
  memoId: string,
  input: ChangeMemoTagRequest,
): Promise<
  | { ok: true; memo: Memo }
  | { ok: false; error: "not_found" | "not_changeable" | "save_failed" }
> {
  const memo = await findMemoForUser(db, userId, memoId);
  const decision = decideTagChange(memo, input.tag);
  if (!decision.ok) return decision;
  if (decision.unchanged && memo)
    return { ok: true, memo: toMemoResponse(memo) };

  const tag = await findTagBySlug(db, input.tag);
  if (!tag) {
    logJson({ event: "memo.tag", status: "failed", userId, memoId });
    return { ok: false, error: "save_failed" };
  }

  let updated: MemoRow | null;
  try {
    updated = await updateMemoTag(db, {
      userId,
      memoId,
      tagId: tag.id,
      tag: tag.slug,
    });
  } catch {
    logJson({ event: "memo.tag", status: "failed", userId, memoId });
    return { ok: false, error: "save_failed" };
  }
  if (updated) return { ok: true, memo: toMemoResponse(updated) };

  // 確認のあとに状態が変わった。削除されていれば 404、グループや予定になったなら 409。
  const current = await findMemoForUser(db, userId, memoId);
  return { ok: false, error: current ? "not_changeable" : "not_found" };
}

// 通知用に Notion からメモを読む。1回の通知で読むのは最大 5 ページ（500 件）まで。
const NOTION_MAX_PAGES = 5;

// truncated は、読める上限で打ち切ったとき true。
export type NotionMemoList =
  | { ok: true; memos: NotionListedMemo[]; truncated: boolean }
  | { ok: false; reason: "no_secret" }
  | { ok: false; reason: "upstream"; httpStatus: number };

async function queryNotionMemos(
  env: Pick<Env, "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID">,
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
  env: Pick<Env, "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID">,
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
  env: Pick<Env, "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID">,
): Promise<NotionMemoList> {
  return queryNotionMemos(env, (cursor) => todoQueryBody(cursor));
}

// 予定日時の JST の日付が date の予定。
export async function listSchedulesFromNotion(
  env: Pick<Env, "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID">,
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

export async function getImageForUser(
  env: Pick<Env, "DB" | "MEDIA">,
  userId: string,
  memoId: string,
) {
  const db = createDb(env.DB);
  const row = await findMemoMedia(db, memoId);
  if (!row || row.userId !== userId || !row.imageKey) {
    return null;
  }
  return getMedia(env.MEDIA, row.imageKey);
}

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

// KV の記録の読み書きは、失敗しても保存を止めない。D1 の一意制約が残っているため。
// 失敗はログに残し、記録なしとして進む。
async function readWebMemoRecord(
  kv: KVNamespace,
  memoId: string,
): Promise<ExistingMemoRow | null> {
  try {
    return await findWebMemo(kv, memoId);
  } catch {
    logJson({ event: "memo.dedup", status: "failed", reason: "read", memoId });
    return null;
  }
}

async function recordWebMemo(
  kv: KVNamespace,
  row: ExistingMemoRow,
): Promise<void> {
  try {
    await putWebMemo(kv, row);
  } catch {
    logJson({
      event: "memo.dedup",
      status: "failed",
      reason: "write",
      memoId: row.id,
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

// D1 に保存したメモを Notion にも書く。正本はまだ D1 なので、失敗してもログだけ残して返す。
// 書けなかったメモは、既存データの移行でメモIDを見て拾う。画像のメモは Notion に書かない。
export async function syncMemoToNotion(
  env: Pick<Env, "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID">,
  memo: NotionMemo,
): Promise<void> {
  if (memo.mediaType === "image") return;
  if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) {
    logJson({
      event: "memo.notion",
      status: "skipped",
      reason: "no_secret",
      memoId: memo.id,
    });
    return;
  }

  const result = await createPage({
    token: env.NOTION_TOKEN,
    body: buildNotionPage(memo, env.NOTION_DATA_SOURCE_ID),
  });
  if (!result.ok) {
    logJson({
      event: "memo.notion",
      status: "failed",
      httpStatus: result.status,
      memoId: memo.id,
    });
  }
}

async function captureOgpImage(
  env: Pick<Env, "DB" | "MEDIA">,
  memo: OgpTarget,
): Promise<Exclude<OgpState, "pending">> {
  const db = createDb(env.DB);

  if (!isHttpsUrl(memo.content)) {
    await updateMemoOgp(db, memo.id, { ogpState: "skipped" });
    return "skipped";
  }

  const image = await fetchOgpImage(memo.content);
  if (!image) {
    await updateMemoOgp(db, memo.id, { ogpState: "failed" });
    logJson({ event: "memo.ogp", status: "failed", memoId: memo.id });
    return "failed";
  }

  const imageKey = memoImageKey(memo.userId, memo.id);
  await putMedia(env.MEDIA, imageKey, image.body, image.contentType);
  await updateMemoOgp(db, memo.id, { ogpState: "ready", imageKey });
  return "ready";
}

function ogpStaleBefore(now: number): string {
  return new Date(now - OGP_CLAIM_STALE_MS).toISOString();
}

export async function captureOgpForMemo(
  env: Pick<Env, "DB" | "MEDIA">,
  memoId: string,
): Promise<void> {
  try {
    const now = Date.now();
    const target = await claimOgp(
      createDb(env.DB),
      memoId,
      new Date(now).toISOString(),
      ogpStaleBefore(now),
    );
    if (target) await captureOgpImage(env, target);
  } catch {
    logJson({ event: "memo.ogp", status: "error", memoId });
  }
}

export async function backfillOgpForUser(
  env: Pick<Env, "DB" | "MEDIA">,
  userId: string,
): Promise<void> {
  const startedAt = Date.now();
  try {
    const ids = await listClaimableOgpIds(
      createDb(env.DB),
      userId,
      ogpStaleBefore(startedAt),
    );
    for (const id of ids) {
      if (Date.now() - startedAt > OGP_BACKFILL_BUDGET_MS) return;
      await captureOgpForMemo(env, id);
    }
  } catch {
    logJson({ event: "memo.ogp.backfill", status: "error" });
  }
}

export async function deleteManyForUser(
  env: Pick<Env, "DB" | "MEDIA">,
  userId: string,
  ids: string[],
): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const rows = await deleteMemosByIds(db, userId, [...new Set(ids)]);
  await deleteImagesForUser(env, userId, rows);
  return { deleted: rows.length };
}

// 消したメモの画像を R2 から消す。失敗はログを残して先へ進む。
export async function deleteImagesForUser(
  env: Pick<Env, "MEDIA">,
  userId: string,
  rows: { id: string; imageKey: string | null }[],
): Promise<void> {
  for (const row of rows) {
    if (!row.imageKey) continue;
    try {
      await deleteMedia(env.MEDIA, row.imageKey);
    } catch {
      logJson({
        event: "memo.image.delete",
        status: "failed",
        userId,
        memoId: row.id,
      });
    }
  }
}

// 「グループに追加」。自分の、どのグループにも入っていない、todo と schedule 以外のメモだけを入れる。
// groupId の持ち主の確認は呼び出し側（groups の service）が行う。
export async function assignGroupForUser(
  db: Database,
  userId: string,
  groupId: string,
  ids: string[],
): Promise<
  | { ok: true; added: number; skippedTodo: number; skippedSchedule: number }
  | { ok: false; error: "group_missing" }
> {
  const uniqueIds = [...new Set(ids)];
  try {
    const result = await assignMemosToGroup(db, userId, groupId, uniqueIds);
    return { ok: true, ...result };
  } catch (error) {
    if (!isForeignKeyViolation(error)) throw error;
    logJson({
      event: "group.assign",
      status: "group_missing",
      userId,
      groupId,
      count: uniqueIds.length,
    });
    return { ok: false, error: "group_missing" };
  }
}

export async function countByGroupForUser(
  db: Database,
  userId: string,
): Promise<Map<string, number>> {
  const rows = await countMemosByGroup(db, userId);
  return new Map(rows.map((row) => [row.groupId, row.count]));
}

// 実行せずに文を返す。groups の service がグループの行の削除と一緒に db.batch で実行する。
export function deleteInGroupStatement(
  db: Database,
  userId: string,
  groupId: string,
) {
  return deleteMemosInGroupStatement(db, userId, groupId);
}

export async function createFromLine(
  env: Pick<
    Env,
    | "DB"
    | "MEDIA"
    | "DEDUP"
    | "LINE_CHANNEL_ACCESS_TOKEN"
    | "NOTION_TOKEN"
    | "NOTION_DATA_SOURCE_ID"
  >,
  input: {
    userId: string;
    lineMessageId: string;
    classified: ClassifySuccess;
  },
): Promise<PersistResult> {
  try {
    // LINE の再送は、先に KV の記録で見分ける。記録が無いか読めないときは D1 で見分ける（#143 まで残す保険）。
    if (await isRecordedLineMessage(env.DEDUP, input.lineMessageId)) {
      return { status: "duplicate" };
    }

    const db = createDb(env.DB);
    const existing = await findByLineMessageId(db, input.lineMessageId);
    if (existing) return { status: "duplicate" };

    const tag = await findTagBySlug(db, input.classified.tag);
    if (!tag) return { status: "failed", reason: "save_failed" };

    const memoId = nanoid();
    let imageKey: string | null = null;

    if (input.classified.mediaType === "image") {
      const content = await fetchMessageContent({
        accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
        messageId: input.lineMessageId,
      });
      if (!content) return { status: "failed", reason: "save_failed" };

      imageKey = memoImageKey(input.userId, memoId);
      await putMedia(env.MEDIA, imageKey, content.body, content.contentType);
    }

    const createdAt = new Date().toISOString();
    await insertMemo(db, {
      id: memoId,
      userId: input.userId,
      tagId: tag.id,
      content: input.classified.content,
      url: null,
      imageKey,
      source: "line",
      mediaType: input.classified.mediaType,
      lineMessageId: input.lineMessageId,
      createdAt,
    });
    await recordLineMessage(env.DEDUP, input.lineMessageId, memoId);
    if (input.classified.mediaType === "url") {
      await captureOgpForMemo(env, memoId);
    }
    await syncMemoToNotion(env, {
      id: memoId,
      tag: input.classified.tag,
      content: input.classified.content,
      mediaType: input.classified.mediaType,
      source: "line",
      createdAt,
    });
    return { status: "inserted" };
  } catch (error) {
    if (isLineMessageIdConflict(error)) return { status: "duplicate" };
    return { status: "failed", reason: "save_failed" };
  }
}
