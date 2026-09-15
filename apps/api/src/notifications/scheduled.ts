import { createDb } from "../db";
import type { Env } from "../env";
import { pushTextMessages } from "../line/client";
import { decideUserDigest, settingsAfterPush } from "./digest";
import { DEFAULT_TECH_WEEKLY } from "./settings";
import {
  listAllowedUsers,
  listTechMemos,
  readStoredSettings,
  upsertSettings,
} from "./store";

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

export async function scheduled(
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  await runTechWeeklyDigest(env, new Date(controller.scheduledTime));
}
