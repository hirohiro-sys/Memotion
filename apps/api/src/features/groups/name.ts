import { hasConstraintCause } from "../../db/constraint-error";

const DUPLICATE_NAME =
  /UNIQUE constraint failed: groups\.user_id, groups\.name(?![\w.])/;

// 同じユーザーの中で同じ名前のグループ（(user_id, name) の一意制約違反）かどうか。
export function isDuplicateGroupName(error: unknown): boolean {
  return hasConstraintCause(error, DUPLICATE_NAME);
}
