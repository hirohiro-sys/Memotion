export type GroupWrite =
  | { kind: "create"; created: boolean }
  | { kind: "assign"; added: number };

// 「最後にメモを入れた日時」を更新するかどうか。
// 同じ id の再送で既存を返したときと、1件も入らなかったときは並び順を変えない。
export function shouldTouchGroup(write: GroupWrite): boolean {
  return write.kind === "create" ? write.created : write.added > 0;
}
