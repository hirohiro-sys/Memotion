# Memo list

The memo list shows the signed-in user's memos, filters them by tag, and searches their text.

## Sub-features

- `list-open` opens the memo tab.
- `list-empty` shows the empty state when the user has no memos.
- `list-filter` filters by tag without creating a memo.
- `list-search` narrows the visible memos by text.
- `list-clear` restores the unfiltered list.

## How to get to it (user POV)

- After login, the app opens `http://127.0.0.1:5173/`.
- Choose the sidebar link `メモ一覧`.
- On the page, choose the tab `メモ`.

## Driving it with the Cursor browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user. If `ログイン` is showing, run the dev-login recipe first.

- **Open the list.** Go to `http://127.0.0.1:5173/`. The heading reads `メモ一覧` and the tab `メモ` is selected.
- **Empty state.** When the user has no memos, the page shows `まだメモがありません`.
- **Filter.** Choose the button whose name starts with `すべて`. It shows the full count. Choose the button whose name starts with `つぶやき`. The list shows only that tag.
- **Search.** Fill the searchbox `メモを検索` with a known memo's text. That memo stays visible. Fill `検索に一致しない文言`. The page shows `検索結果が見つかりません`.
- **Clear.** Choose the button `検索をクリア`. The searchbox is empty and the previous list returns.
- **Proof.** Save the snapshot to `artifacts/memo-list/list.aria.txt` and a screenshot to `artifacts/memo-list/list.png`.

## Gotchas

- Filter and tag buttons include the count in the accessible name, such as `すべて 0`. Match the label prefix, not the whole string.
- Search does not create or delete memos. A proof that only searches must not claim a new row.
- `オフラインのため既存のメモは表示できません` means the server list is hidden. Stop.
