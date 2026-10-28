import { createDb } from "../../db";
import type { Env } from "../../env";
import { claimSync, listDueUsers } from "./repository";
import { apiKeyOf, syncUser } from "./service";
import { CRON_INTERVAL_MS, syncNotAfter } from "./sync-timing";

// connpass は 1 キーにつき 1 秒に 1 リクエスト。キーは全ユーザーで 1 つなので、人の間もあける。
const USER_INTERVAL_MS = 1000;
// 1 回の実行で処理する人数。毎分動くので、残りは次の分に回る。
// 実行が長引いても次の分の実行と重ならないよう、1 人ずつにする（キーは全ユーザーで 1 秒に 1 リクエスト）。
const MAX_USERS_PER_TICK = 1;

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cron から呼ぶ。取り込みの時刻が来たユーザーを、1 人ずつ処理する。
export async function runConnpassSync(
  env: Pick<Env, "DB" | "CONNPASS_API_KEY">,
  now: Date,
): Promise<void> {
  const db = createDb(env.DB);
  const due = await listDueUsers(
    db,
    syncNotAfter(now, CRON_INTERVAL_MS),
    MAX_USERS_PER_TICK,
  );
  if (due.length === 0) return;
  const apiKey = apiKeyOf(env);
  if (apiKey === null) {
    logJson({
      event: "connpass.sync",
      action: "skipped",
      reason: "no_api_key",
    });
    return;
  }

  let synced = 0;
  let failed = 0;
  for (const user of due) {
    try {
      if (synced + failed > 0) await sleep(USER_INTERVAL_MS);
      // 通知の処理で遅れるので、予定の Cron の時刻（now）ではなく、取り込みを始める直前の時刻で先取りする。
      const startedAt = new Date();
      const claimed = await claimSync(
        db,
        user.userId,
        startedAt.toISOString(),
        syncNotAfter(startedAt, CRON_INTERVAL_MS),
      );
      if (!claimed) continue;
      const outcome = await syncUser(env, user, apiKey, startedAt, "cron");
      if (outcome.status === "success") synced += 1;
      else failed += 1;
    } catch {
      failed += 1;
      logJson({
        event: "connpass.sync",
        status: "failed",
        reason: "unexpected",
        userId: user.userId,
        trigger: "cron",
      });
    }
  }
  logJson({ event: "connpass.sync", action: "tick", synced, failed });
}
