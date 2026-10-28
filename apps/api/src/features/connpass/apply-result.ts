// イベント1件の反映（db.batch）の結果。
export type ApplyOutcome = "ok" | "unique" | "error";

// 同じイベントを別の実行が先に作った（対応表の一意制約の違反）か、それ以外の失敗かを分ける。
export function classifyApplyError(error: unknown): "unique" | "error" {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE constraint failed") ? "unique" : "error";
}

// 反映の結果の列から、全体の成否を決める。一意制約の違反は飛ばすだけで、失敗に数えない。
// それ以外の失敗が1件でもあれば failed（成功を装わない）。
export function summarizeApply(outcomes: ApplyOutcome[]): {
  status: "success" | "failed";
  failedActions: number;
} {
  const failedActions = outcomes.filter(
    (outcome) => outcome === "error",
  ).length;
  return { status: failedActions === 0 ? "success" : "failed", failedActions };
}

// 保存し直しが、同じユーザー名か。同じなら、connpass を呼ばずに終える（共有のキーを無駄に使わない）。
export function isSameNickname(
  saved: string | null | undefined,
  requested: string,
): boolean {
  return saved === requested;
}
