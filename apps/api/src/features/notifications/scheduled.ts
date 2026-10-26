import { createDb } from "../../db";
import type { Env } from "../../env";
import { pushTextMessages } from "../../lib/line/client";
import { listSchedulesOnDateForUser } from "../memos/service";
import {
  decideTodoDailyDigest,
  decideUserDigest,
  settingsAfterPush,
} from "./digest";
import { buildScheduleDigestMessages } from "./message";
import {
  claimScheduleTarget,
  disableScheduleSettings,
  listAllowedUsers,
  listTechMemos,
  listTodoMemos,
  readStoredDailySettings,
  readStoredScheduleSettings,
  readStoredSettings,
  revertScheduleTarget,
  upsertDailySettings,
  upsertSettings,
} from "./repository";
import { runIndependently } from "./run-independently";
import { afterSchedulePush, decideScheduleDigest } from "./schedule-digest";
import {
  DEFAULT_SCHEDULE_DAILY,
  DEFAULT_TECH_WEEKLY,
  DEFAULT_TODO_DAILY,
} from "./settings";

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

export async function runTechWeeklyDigest(env: Env, now: Date): Promise<void> {
  const db = createDb(env.DB);
  const allowed = await listAllowedUsers(db);
  let sent = 0;
  let unreachable = 0;
  let transient = 0;
  let empty = 0;
  let failed = 0;

  for (const user of allowed) {
    try {
      const settings =
        (await readStoredSettings(db, user.id)) ?? DEFAULT_TECH_WEEKLY;
      const memos = await listTechMemos(db, user.id);
      const decision = decideUserDigest({
        settings,
        now,
        memos,
        appUrl: env.APP_URL,
      });

      if (decision.action === "skip") {
        if (decision.reason === "empty") {
          empty += 1;
          logJson({
            event: "tech.weekly",
            userId: user.id,
            action: "skipped",
            reason: "empty",
          });
        }
        continue;
      }

      const result = await pushTextMessages({
        accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
        to: user.lineUserId,
        texts: decision.texts,
      });
      const next = settingsAfterPush(settings, result, now);
      if (next) {
        await upsertSettings(db, user.id, next);
      }

      if (result === "success") sent += 1;
      if (result === "unreachable") unreachable += 1;
      if (result === "transient") transient += 1;

      logJson({
        event: "tech.weekly",
        userId: user.id,
        action: result,
        count: decision.texts.length,
      });
    } catch {
      failed += 1;
      logJson({
        event: "tech.weekly",
        userId: user.id,
        action: "failed",
      });
    }
  }

  logJson({
    event: "tech.weekly",
    action: "tick",
    users: allowed.length,
    sent,
    unreachable,
    transient,
    empty,
    failed,
  });
}

export async function runTodoDailyDigest(env: Env, now: Date): Promise<void> {
  const db = createDb(env.DB);
  const allowed = await listAllowedUsers(db);
  let sent = 0;
  let unreachable = 0;
  let transient = 0;
  let empty = 0;
  let failed = 0;

  for (const user of allowed) {
    try {
      const settings =
        (await readStoredDailySettings(db, user.id)) ?? DEFAULT_TODO_DAILY;
      const memos = await listTodoMemos(db, user.id);
      const decision = decideTodoDailyDigest({
        settings,
        now,
        memos,
        appUrl: env.APP_URL,
      });

      if (decision.action === "skip") {
        if (decision.reason === "empty") {
          empty += 1;
          logJson({
            event: "todo.daily",
            userId: user.id,
            action: "skipped",
            reason: "empty",
          });
        }
        continue;
      }

      const result = await pushTextMessages({
        accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
        to: user.lineUserId,
        texts: decision.texts,
      });
      const next = settingsAfterPush(settings, result, now);
      if (next) {
        await upsertDailySettings(db, user.id, next);
      }

      if (result === "success") sent += 1;
      if (result === "unreachable") unreachable += 1;
      if (result === "transient") transient += 1;

      logJson({
        event: "todo.daily",
        userId: user.id,
        action: result,
        count: decision.texts.length,
      });
    } catch {
      failed += 1;
      logJson({
        event: "todo.daily",
        userId: user.id,
        action: "failed",
      });
    }
  }

  logJson({
    event: "todo.daily",
    action: "tick",
    users: allowed.length,
    sent,
    unreachable,
    transient,
    empty,
    failed,
  });
}

// 予定の前日通知。判断は設定の行だけで行い、送ると決まったあとにだけ、先取りと予定の取得を行う。
// 先取りは予定の取得と送信より前に行い、同じ対象日の予定が2回届かないようにする。
export async function runScheduleDailyDigest(
  env: Env,
  now: Date,
): Promise<void> {
  const db = createDb(env.DB);
  const allowed = await listAllowedUsers(db);
  let sent = 0;
  let unreachable = 0;
  let transient = 0;
  let empty = 0;
  let stale = 0;
  let failed = 0;

  for (const user of allowed) {
    try {
      const settings =
        (await readStoredScheduleSettings(db, user.id)) ??
        DEFAULT_SCHEDULE_DAILY;
      const decision = decideScheduleDigest({ settings, now });

      if (decision.action === "skip") {
        if (decision.reason !== "stale") continue;
        if (!(await claimScheduleTarget(db, user.id, decision.targetDate))) {
          continue;
        }
        const missed = await listSchedulesOnDateForUser(
          db,
          user.id,
          decision.targetDate,
        );
        stale += 1;
        logJson({
          event: "schedule.daily",
          userId: user.id,
          action: "skipped",
          reason: "stale",
          count: missed.length,
        });
        continue;
      }

      if (!(await claimScheduleTarget(db, user.id, decision.targetDate))) {
        continue;
      }
      let prepared: { count: number; texts: string[] };
      try {
        const schedules = await listSchedulesOnDateForUser(
          db,
          user.id,
          decision.targetDate,
        );
        prepared = {
          count: schedules.length,
          texts: buildScheduleDigestMessages({
            schedules,
            targetDate: decision.targetDate,
            appUrl: env.APP_URL,
          }),
        };
      } catch (error) {
        // まだ LINE に送っていないので、先取りを戻して次の分に再試行する（取りこぼさない）。
        await revertScheduleTarget(
          db,
          user.id,
          decision.targetDate,
          settings.lastTargetDate,
        );
        throw error;
      }
      if (prepared.count === 0) {
        empty += 1;
        logJson({
          event: "schedule.daily",
          userId: user.id,
          action: "skipped",
          reason: "empty",
        });
        continue;
      }

      const { count, texts } = prepared;
      const result = await pushTextMessages({
        accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
        to: user.lineUserId,
        texts,
      });
      const followUp = afterSchedulePush(result, settings.lastTargetDate);
      if (followUp.action === "revert") {
        // 戻せなければ外の catch で failed になり、その日の分は送らない（二重送信より取りこぼしを選ぶ）。
        await revertScheduleTarget(
          db,
          user.id,
          decision.targetDate,
          followUp.lastTargetDate,
        );
      }
      if (followUp.action === "disable") {
        await disableScheduleSettings(db, user.id, followUp.disabledReason);
      }

      if (result === "success") sent += 1;
      if (result === "unreachable") unreachable += 1;
      if (result === "transient") transient += 1;

      logJson({
        event: "schedule.daily",
        userId: user.id,
        action: result,
        count,
        messages: texts.length,
      });
    } catch {
      failed += 1;
      logJson({
        event: "schedule.daily",
        userId: user.id,
        action: "failed",
      });
    }
  }

  logJson({
    event: "schedule.daily",
    action: "tick",
    users: allowed.length,
    sent,
    unreachable,
    transient,
    empty,
    stale,
    failed,
  });
}

export async function scheduled(
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const now = new Date(controller.scheduledTime);
  // 1つの通知の失敗（listAllowedUsers の失敗を含む）で、ほかの通知を止めない。
  const { failed } = await runIndependently([
    { name: "tech.weekly", run: () => runTechWeeklyDigest(env, now) },
    { name: "todo.daily", run: () => runTodoDailyDigest(env, now) },
    { name: "schedule.daily", run: () => runScheduleDailyDigest(env, now) },
  ]);
  for (const event of failed) {
    logJson({ event, action: "failed" });
  }
}
