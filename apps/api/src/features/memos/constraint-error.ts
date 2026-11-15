import { hasConstraintCause } from "../../db/constraint-error";

const FOREIGN_KEY_VIOLATION = /FOREIGN KEY constraint failed/;
const LINE_MESSAGE_ID_CONFLICT =
  /UNIQUE constraint failed: memos\.line_message_id(?!\w)/;

// memos.group_id の参照違反（持ち主の確認のあとにグループが消えた）かどうか。
export function isForeignKeyViolation(error: unknown): boolean {
  return hasConstraintCause(error, FOREIGN_KEY_VIOLATION);
}

// 同じ LINE メッセージの同時受信で、後から挿入した側が memos.line_message_id の一意制約に当たったかどうか。
export function isLineMessageIdConflict(error: unknown): boolean {
  return hasConstraintCause(error, LINE_MESSAGE_ID_CONFLICT);
}
