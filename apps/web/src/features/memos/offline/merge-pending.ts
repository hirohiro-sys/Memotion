import type { Memo, MemoTag } from "@repo/shared";
import type { OutboxItem } from "./outbox";

// 一覧の先頭に出す送信待ちを選ぶ。取得済みの一覧に同じ id があれば、送信が済んだので隠す
// （端末が付けた id がそのままサーバーの id になる）。タグのフィルタ（空なら全部、複数ならどれか）と検索も一覧と同じ条件で掛ける。
export function visiblePendingItems(
  items: OutboxItem[],
  memos: Memo[],
  filterTags: ReadonlySet<MemoTag>,
  search: string,
): OutboxItem[] {
  const savedIds = new Set(memos.map((memo) => memo.id));
  const query = search.trim().toLowerCase();
  return items.filter(
    (item) =>
      !savedIds.has(item.id) &&
      (filterTags.size === 0 || filterTags.has(item.tag)) &&
      (!query || item.content.toLowerCase().includes(query)),
  );
}
