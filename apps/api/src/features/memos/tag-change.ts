import type { ChangeableMemoTag } from "@repo/shared";

export type TagChangeDecision =
  | { ok: true; unchanged: boolean }
  | { ok: false; error: "not_found" | "not_changeable" };

// タグを付け直せるのは、予定でなく、グループに入っていないメモだけ。
// repository の更新の WHERE（group_id IS NULL かつ schedule でない）と同じ意味にする。
export function decideTagChange(
  memo: { tag: string; groupId: string | null } | null,
  target: ChangeableMemoTag,
): TagChangeDecision {
  if (!memo) return { ok: false, error: "not_found" };
  if (memo.groupId !== null || memo.tag === "schedule") {
    return { ok: false, error: "not_changeable" };
  }
  return { ok: true, unchanged: memo.tag === target };
}
