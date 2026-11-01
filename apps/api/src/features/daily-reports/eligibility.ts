export type MemoUseDecision = "ok" | "not_found" | "ineligible";

// 不足と余分を、グループ入りより先に見る。グループの有無を漏らさないため。
export function decideMemoUse(
  requestedIds: readonly string[],
  rows: readonly { id: string; groupId: string | null }[],
): MemoUseDecision {
  const found = new Set(rows.map((row) => row.id));
  if (
    found.size !== requestedIds.length ||
    requestedIds.some((id) => !found.has(id))
  ) {
    return "not_found";
  }
  if (rows.some((row) => row.groupId !== null)) return "ineligible";
  return "ok";
}
