import type { Env } from "../../env";
import { type PushResult, pushTextMessages } from "../../lib/line/client";
import {
  listSchedulesFromNotion,
  listTechMemosFromNotion,
  listTodoMemosFromNotion,
  type NotionMemoList,
} from "../memos/service";
import { parseDailySetting, parseWeeklySetting } from "./config";
import {
  buildTechWeeklyTexts,
  buildTodoDailyTexts,
  decideTechWeekly,
  decideTodoDaily,
  shouldRecordAfterPush,
} from "./digest";
import { buildScheduleDigestMessages } from "./message";
import { runIndependently } from "./run-independently";
import { decideScheduleDigest } from "./schedule-digest";
import {
  readLastSentAt,
  readScheduleLastTargetDate,
  restoreScheduleLastTargetDate,
  writeLastSentAt,
  writeScheduleLastTargetDate,
} from "./sent-repository";

// LINE 通知。設定は環境変数、メモは Notion、送信済みの記録は KV（DEDUP）。
// 毎分の cron で呼ばれる。Notion を読むのは、送る時刻が来たときだけ。
// ログは何か起きたときだけ1行出す（時刻が来ていない、オフ、処理済みは出さない）。

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

function linkUrl(env: Env): string {
  return env.NOTION_VIEW_URL || env.APP_URL;
}

type Outcome =
  | {
      action: PushResult;
      count: number;
      messages: number;
      truncated?: true;
    }
  | { action: "skipped"; reason: "empty" | "no_recipient" | "no_secret" }
  | { action: "failed"; reason: "upstream"; httpStatus: number };

// メモを読んで送る。送る相手か Notion の秘密が無ければ送らない。
async function pushMemos(
  env: Env,
  list: () => Promise<NotionMemoList>,
  build: (memos: Extract<NotionMemoList, { ok: true }>["memos"]) => string[],
): Promise<Outcome> {
  if (!env.NOTIFY_LINE_USER_ID) {
    return { action: "skipped", reason: "no_recipient" };
  }
  const listed = await list();
  if (!listed.ok) {
    return listed.reason === "no_secret"
      ? { action: "skipped", reason: "no_secret" }
      : { action: "failed", reason: "upstream", httpStatus: listed.httpStatus };
  }
  const texts = build(listed.memos);
  if (texts.length === 0) return { action: "skipped", reason: "empty" };
  const result = await pushTextMessages({
    accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
    to: env.NOTIFY_LINE_USER_ID,
    texts,
  });
  return {
    action: result,
    count: listed.memos.length,
    messages: texts.length,
    // 読める上限で打ち切った。見出しの件数は読めた分だけになる。
    ...(listed.truncated ? { truncated: true as const } : {}),
  };
}

// 認証や ID の誤りなど、送り直しても直らない Notion の失敗。
const PERMANENT_NOTION_FAILURES = new Set([400, 401, 403, 404]);

// 送信済みとして記録するか。一時的な Notion の失敗（ネットワーク、429、5xx）と一時的な送信の失敗は
// 記録せず、次の分に送り直す。直らない Notion の失敗は記録し、毎分読み直さない（直したあとに古い回を送らない）。
function shouldRecord(outcome: Outcome): boolean {
  if (outcome.action === "failed") {
    return PERMANENT_NOTION_FAILURES.has(outcome.httpStatus);
  }
  if (outcome.action === "skipped") return true;
  return shouldRecordAfterPush(outcome.action);
}

export async function runTechWeeklyDigest(env: Env, now: Date): Promise<void> {
  const setting = parseWeeklySetting(env.TECH_WEEKLY);
  if (setting.state === "invalid") {
    logJson({ event: "tech.weekly", action: "skipped", reason: "invalid" });
    return;
  }
  if (setting.state === "off") return;

  const lastSentAt = await readLastSentAt(env.DEDUP, "techWeekly");
  const decision = decideTechWeekly({ slot: setting.slot, now, lastSentAt });
  if (decision.action === "not_due") return;
  if (decision.action === "baseline") {
    await writeLastSentAt(env.DEDUP, "techWeekly", now.toISOString());
    logJson({ event: "tech.weekly", action: "skipped", reason: "baseline" });
    return;
  }

  const outcome = await pushMemos(
    env,
    () => listTechMemosFromNotion(env, decision.window),
    (memos) =>
      buildTechWeeklyTexts({
        memos,
        window: decision.window,
        linkUrl: linkUrl(env),
      }),
  );
  if (shouldRecord(outcome)) {
    await writeLastSentAt(env.DEDUP, "techWeekly", now.toISOString());
  }
  logJson({ event: "tech.weekly", ...outcome });
}

export async function runTodoDailyDigest(env: Env, now: Date): Promise<void> {
  const setting = parseDailySetting(env.TODO_DAILY);
  if (setting.state === "invalid") {
    logJson({ event: "todo.daily", action: "skipped", reason: "invalid" });
    return;
  }
  if (setting.state === "off") return;

  const lastSentAt = await readLastSentAt(env.DEDUP, "todoDaily");
  const decision = decideTodoDaily({ slot: setting.slot, now, lastSentAt });
  if (decision.action === "not_due") return;
  if (decision.action === "baseline") {
    await writeLastSentAt(env.DEDUP, "todoDaily", now.toISOString());
    logJson({ event: "todo.daily", action: "skipped", reason: "baseline" });
    return;
  }

  const outcome = await pushMemos(
    env,
    () => listTodoMemosFromNotion(env),
    (memos) => buildTodoDailyTexts({ memos, linkUrl: linkUrl(env) }),
  );
  if (shouldRecord(outcome)) {
    await writeLastSentAt(env.DEDUP, "todoDaily", now.toISOString());
  }
  logJson({ event: "todo.daily", ...outcome });
}

// 予定の前日通知。先取り（対象日を処理済みにする）は Notion を読む前と送る前に行い、
// 同じ対象日の予定が2回届かないようにする。記録しない失敗（一時的なもの）では先取りを戻す。
export async function runScheduleDailyDigest(
  env: Env,
  now: Date,
): Promise<void> {
  const setting = parseDailySetting(env.SCHEDULE_DAILY);
  if (setting.state === "invalid") {
    logJson({ event: "schedule.daily", action: "skipped", reason: "invalid" });
    return;
  }
  if (setting.state === "off") return;

  const lastTargetDate = await readScheduleLastTargetDate(env.DEDUP);
  const decision = decideScheduleDigest({
    slot: setting.slot,
    lastTargetDate,
    now,
  });
  if (decision.action === "skip" && decision.reason === "already") return;
  if (decision.action === "baseline" || decision.action === "skip") {
    await writeScheduleLastTargetDate(env.DEDUP, decision.targetDate);
    logJson({
      event: "schedule.daily",
      action: "skipped",
      reason: decision.action === "baseline" ? "baseline" : "stale",
    });
    return;
  }

  await writeScheduleLastTargetDate(env.DEDUP, decision.targetDate);
  let outcome: Outcome;
  try {
    outcome = await pushMemos(
      env,
      () => listSchedulesFromNotion(env, decision.targetDate),
      (memos) =>
        buildScheduleDigestMessages({
          schedules: memos,
          targetDate: decision.targetDate,
          appUrl: linkUrl(env),
        }),
    );
  } catch (error) {
    // Notion を読む途中の例外（LINE にはまだ送っていない）。先取りを戻して次の分に再試行する。
    await restoreScheduleLastTargetDate(env.DEDUP, lastTargetDate);
    throw error;
  }

  if (!shouldRecord(outcome)) {
    // 戻せなければ外の catch で failed になり、その日の分は送らない（二重送信より取りこぼしを選ぶ）。
    await restoreScheduleLastTargetDate(env.DEDUP, lastTargetDate);
  }
  logJson({ event: "schedule.daily", ...outcome });
}

export async function scheduled(
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const now = new Date(controller.scheduledTime);
  // 1つの通知の失敗（KV の失敗を含む）で、ほかの通知を止めない。
  const { failed } = await runIndependently([
    { name: "tech.weekly", run: () => runTechWeeklyDigest(env, now) },
    { name: "todo.daily", run: () => runTodoDailyDigest(env, now) },
    { name: "schedule.daily", run: () => runScheduleDailyDigest(env, now) },
  ]);
  for (const event of failed) {
    logJson({ event, action: "failed" });
  }
}
