import { hasConstraintCause } from "../../db/constraint-error";

const FOREIGN_KEY_VIOLATION = /FOREIGN KEY constraint failed/;

// memos.group_id の参照違反（持ち主の確認のあとにグループが消えた）かどうか。
export function isForeignKeyViolation(error: unknown): boolean {
  return hasConstraintCause(error, FOREIGN_KEY_VIOLATION);
}
