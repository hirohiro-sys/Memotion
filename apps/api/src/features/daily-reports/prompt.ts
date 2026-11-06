import type { DailyReportFramework } from "@repo/shared";
import { jstDateTime } from "../../lib/jst";

const LOG_INSTRUCTION =
  "材料全体を要約し、一日の流れを時刻ごとの短い箇条書きにしてください。メモを1件ずつ写さず、同じ話題はまとめてください。材料に無いことは書かないでください。本文だけを書いてください。先頭行は書かないでください。";
const ACHIEVEMENT_INSTRUCTION =
  "材料全体を要約し、「やったこと」「気づき」「次にやること」の見出しで本文だけを書いてください。メモを1件ずつ写さず、同じ話題はまとめてください。材料に無いことは書かないでください。先頭行は書かないでください。";

export type PromptMemo = {
  id: string;
  content: string;
  createdAt: string;
  url: string | null;
  tag: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

export type PromptResult =
  | { ok: true; text: string }
  | { ok: false; reason: "unparsed_time" };

export function comparePromptOrder(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string },
): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function formatJst(iso: string): string | null {
  const jst = jstDateTime(new Date(iso));
  return jst ? `${jst.date} ${jst.time}` : null;
}

export function buildPrompt(
  framework: DailyReportFramework,
  memos: readonly PromptMemo[],
): PromptResult {
  const sorted = [...memos].sort(comparePromptOrder);
  const blocks: string[] = [];
  for (const memo of sorted) {
    const created = formatJst(memo.createdAt);
    if (!created) return { ok: false, reason: "unparsed_time" };
    const lines = [`作成日時: ${created}`, memo.content];
    if (memo.url) lines.push(`URL: ${memo.url}`);
    if (memo.tag === "schedule") {
      lines.push(`予定日: ${memo.scheduledDate ?? ""}`);
      lines.push(`予定時刻: ${memo.scheduledTime ?? "時間未定"}`);
    }
    blocks.push(lines.join("\n"));
  }
  const instruction =
    framework === "log" ? LOG_INSTRUCTION : ACHIEVEMENT_INSTRUCTION;
  return { ok: true, text: `${instruction}\n\n${blocks.join("\n\n")}` };
}
