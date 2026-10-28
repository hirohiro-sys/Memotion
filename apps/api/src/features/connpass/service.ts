import type { ConnpassSettings, ConnpassSyncResponse } from "@repo/shared";
import { nanoid } from "nanoid";
import { createDb, type Database } from "../../db";
import type { Env } from "../../env";
import {
  findScheduleTagId,
  importedScheduleDeleteStatement,
  importedScheduleInsertStatement,
  importedScheduleUpdateStatement,
} from "../memos/service";
import {
  type ApplyOutcome,
  classifyApplyError,
  isSameNickname,
  summarizeApply,
} from "./apply-result";
import { checkUserExists, fetchAttendedEvents } from "./client";
import {
  fetchRangeEnd,
  jstDateString,
  monthsToFetch,
  toJstSchedule,
} from "./event-schedule";
import { planConnpassSync, type SyncAction } from "./plan";
import {
  claimSync,
  deleteImportStatement,
  deleteSettings,
  insertImportStatement,
  listImports,
  readSettings,
  recordSyncStatus,
  saveNickname,
  updateImportStatement,
} from "./repository";
import { isSyncDue, MANUAL_INTERVAL_MS, syncNotAfter } from "./sync-timing";

export type Trigger = "cron" | "manual";

export type SyncOutcome =
  | { status: "success"; summary: ConnpassSyncResponse }
  | { status: "failed"; httpStatus?: number };

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

export function apiKeyOf(env: Pick<Env, "CONNPASS_API_KEY">): string | null {
  const key = env.CONNPASS_API_KEY?.trim();
  return key ? key : null;
}

export async function getConnpassSettings(
  db: Database,
  userId: string,
): Promise<ConnpassSettings> {
  const row = await readSettings(db, userId);
  return {
    nickname: row?.nickname ?? null,
    lastSyncedAt: row?.lastSyncedAt ?? null,
    lastSyncStatus:
      row?.lastSyncStatus === "success" || row?.lastSyncStatus === "failed"
        ? row.lastSyncStatus
        : null,
  };
}

export type SaveSettingsResult =
  | { status: "ok" }
  | { status: "user_not_found" }
  | { status: "unavailable" };

// ユーザー名を保存する。保存の前に connpass で実在を確かめ、打ち間違いを弾く
// （結果が 0 件になり、取り込み済みの予定をまとめて消すのを防ぐ）。null なら設定を消して取り込みを止める。
export async function saveConnpassNickname(
  env: Pick<Env, "DB" | "CONNPASS_API_KEY">,
  userId: string,
  nickname: string | null,
): Promise<SaveSettingsResult> {
  const db = createDb(env.DB);
  if (nickname === null) {
    await deleteSettings(db, userId);
    return { status: "ok" };
  }
  // 同じユーザー名の保存し直しは、connpass を呼ばずに終える（共有のキーを無駄に使わない）。
  if (isSameNickname((await readSettings(db, userId))?.nickname, nickname)) {
    return { status: "ok" };
  }
  const apiKey = apiKeyOf(env);
  if (apiKey === null) {
    logJson({
      event: "connpass.sync",
      action: "skipped",
      reason: "no_api_key",
      userId,
    });
    return { status: "unavailable" };
  }
  const found = await checkUserExists({ apiKey, nickname });
  if (found.status === "failed") {
    logJson({
      event: "connpass.sync",
      action: "failed",
      reason: "user_check",
      userId,
      httpStatus: found.httpStatus,
    });
    return { status: "unavailable" };
  }
  if (!found.exists) return { status: "user_not_found" };
  // connpass が返した表記（大文字小文字）で保存する。入力の表記のままだと、検索が一致せず 0 件になりうる。
  await saveNickname(db, userId, found.nickname);
  return { status: "ok" };
}

// 予定と対応表の書き込みを、イベントごとに 1 つの batch にまとめる（片方だけ書かれた状態を作らない）。
async function applyAction(
  db: Database,
  userId: string,
  scheduleTagId: string,
  action: SyncAction,
  nowIso: string,
): Promise<void> {
  if (action.type === "create") {
    const memoId = nanoid();
    const { title, date, time } = action.values;
    await db.batch([
      importedScheduleInsertStatement(db, {
        id: memoId,
        userId,
        tagId: scheduleTagId,
        content: title,
        scheduledDate: date,
        scheduledTime: time,
        createdAt: nowIso,
      }),
      insertImportStatement(db, {
        userId,
        eventId: action.eventId,
        memoId,
        title,
        date,
        time,
        createdAt: nowIso,
      }),
    ]);
    return;
  }
  if (action.type === "update") {
    const { title, date, time } = action.values;
    await db.batch([
      importedScheduleUpdateStatement(db, {
        userId,
        memoId: action.memoId,
        content: title,
        scheduledDate: date,
        scheduledTime: time,
      }),
      updateImportStatement(db, {
        userId,
        eventId: action.eventId,
        title,
        date,
        time,
      }),
    ]);
    return;
  }
  await db.batch([
    importedScheduleDeleteStatement(db, userId, action.memoId),
    deleteImportStatement(db, userId, action.eventId),
  ]);
}

// 1 ユーザーの取り込み。呼ぶ前に claimSync で開始を取っておく。
export async function syncUser(
  env: Pick<Env, "DB" | "CONNPASS_API_KEY">,
  user: { userId: string; nickname: string },
  apiKey: string,
  now: Date,
  trigger: Trigger,
): Promise<SyncOutcome> {
  const db = createDb(env.DB);
  const fail = async (
    reason: string,
    httpStatus?: number,
  ): Promise<SyncOutcome> => {
    await recordSyncStatus(db, user.userId, "failed").catch(() => undefined);
    logJson({
      event: "connpass.sync",
      status: "failed",
      reason,
      userId: user.userId,
      trigger,
      httpStatus,
    });
    return { status: "failed", httpStatus };
  };

  const fetched = await fetchAttendedEvents({
    apiKey,
    nickname: user.nickname,
    months: monthsToFetch(now),
  });
  if (fetched.status === "failed") {
    return fail("fetch", fetched.httpStatus);
  }

  try {
    const scheduleTagId = await findScheduleTagId(db);
    if (scheduleTagId === null) return await fail("no_schedule_tag");
    const imports = await listImports(db, user.userId);
    const actions = planConnpassSync({
      events: fetched.events,
      complete: fetched.complete,
      imports,
      today: jstDateString(now),
      rangeEnd: fetchRangeEnd(now),
      toSchedule: toJstSchedule,
    });

    const summary = { created: 0, updated: 0, deleted: 0 };
    const outcomes: ApplyOutcome[] = [];
    for (const action of actions) {
      try {
        await applyAction(
          db,
          user.userId,
          scheduleTagId,
          action,
          now.toISOString(),
        );
        if (action.type === "create") summary.created += 1;
        else if (action.type === "update") summary.updated += 1;
        else summary.deleted += 1;
        outcomes.push("ok");
      } catch (error) {
        // 同じイベントを別の実行が先に作った（一意制約の違反）。そのイベントは飛ばし、失敗にしない。
        const kind = classifyApplyError(error);
        outcomes.push(kind);
        if (kind === "unique") continue;
        // D1 の例外の message には本文が入りうるので、投げ直さず、ID だけを出す。
        logJson({
          event: "connpass.sync",
          status: "failed",
          reason: "apply",
          userId: user.userId,
          trigger,
          action: action.type,
        });
      }
    }

    const { status, failedActions } = summarizeApply(outcomes);
    await recordSyncStatus(db, user.userId, status);
    logJson({
      event: "connpass.sync",
      status,
      userId: user.userId,
      trigger,
      ...summary,
      failedActions,
      complete: fetched.complete,
      pages: fetched.pages,
    });
    // 一部でも反映できなかったときは、成功を装わず失敗として返す（設定欄の「失敗」と揃える）。
    if (failedActions > 0) return { status: "failed" };
    return {
      status: "success",
      summary: { ...summary, complete: fetched.complete },
    };
  } catch {
    return fail("apply");
  }
}

export type ManualSyncResult =
  | SyncOutcome
  | { status: "not_configured" }
  | { status: "too_soon" }
  | { status: "unavailable" };

// 「今すぐ取り込む」。ユーザー名が無ければ not_configured、前回から 60 秒以内なら too_soon。
export async function runManualSync(
  env: Pick<Env, "DB" | "CONNPASS_API_KEY">,
  userId: string,
  now: Date,
): Promise<ManualSyncResult> {
  const db = createDb(env.DB);
  const settings = await readSettings(db, userId);
  if (settings === null) return { status: "not_configured" };
  const apiKey = apiKeyOf(env);
  if (apiKey === null) {
    logJson({
      event: "connpass.sync",
      action: "skipped",
      reason: "no_api_key",
      userId,
    });
    return { status: "unavailable" };
  }
  // 先に間隔を確かめる（書き込みを減らす）。別の実行と重なる場合は、下の先取りの1文が決める。
  const claimed =
    isSyncDue(settings.lastSyncedAt, now, MANUAL_INTERVAL_MS) &&
    (await claimSync(
      db,
      userId,
      now.toISOString(),
      syncNotAfter(now, MANUAL_INTERVAL_MS),
    ));
  if (!claimed) {
    logJson({
      event: "connpass.sync",
      action: "skipped",
      reason: "too_soon",
      userId,
      trigger: "manual",
    });
    return { status: "too_soon" };
  }
  return syncUser(
    env,
    { userId, nickname: settings.nickname },
    apiKey,
    now,
    "manual",
  );
}
