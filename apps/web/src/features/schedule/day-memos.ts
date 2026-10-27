import type { Memo } from "@repo/shared";
import { jstDateOf } from "./jst";

// 同じ作成日時なら id の順にして、並びを安定させる。
function byCreatedAt(a: Memo, b: Memo): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

// 予定以外のメモを、作成日（JST）ごとにまとめ、書いた順（古い順）に並べる。
// 予定は予定日の「予定」の節に出るので、ここには入れない。
export function groupMemosByCreatedDate(memos: Memo[]): Map<string, Memo[]> {
  const byDate = new Map<string, Memo[]>();
  for (const memo of memos) {
    if (memo.tag === "schedule") continue;
    const date = jstDateOf(memo.createdAt);
    const list = byDate.get(date) ?? [];
    list.push(memo);
    byDate.set(date, list);
  }
  for (const list of byDate.values()) list.sort(byCreatedAt);
  return byDate;
}
