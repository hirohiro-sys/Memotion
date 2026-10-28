import type { Env } from "./env";
import { runConnpassSync } from "./features/connpass/scheduled";
import { runIndependently } from "./features/notifications/run-independently";
import { scheduled as scheduledNotifications } from "./features/notifications/scheduled";

// Cron の入口。通知と connpass の取り込みを、互いの失敗で止めないように順に動かす。
export async function scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const now = new Date(controller.scheduledTime);
  const { failed } = await runIndependently([
    {
      name: "notifications",
      run: () => scheduledNotifications(controller, env, ctx),
    },
    { name: "connpass.sync", run: () => runConnpassSync(env, now) },
  ]);
  for (const event of failed) {
    console.log(JSON.stringify({ event, action: "failed" }));
  }
}
