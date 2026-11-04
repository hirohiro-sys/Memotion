# Memo list

The memo list shows the signed-in user's memos, filters them by one or more tags, lets the user select cards for a bulk action, and shows memos that are still waiting to be sent from this device. Searching has its own file, [memo-search.md](./memo-search.md).

## Sub-features

- `list-open` opens the memo tab.
- `list-empty` shows the empty state when the user has no memos.
- `list-filter` toggles tag buttons. Several tags can be on at once and a memo shows when it has any selected tag.
- `list-filter-reset` restores the full list with `すべて`.
- `list-bulk-delete` selects memos and deletes them after a confirmation.
- `list-pending` shows a memo that is waiting to be sent, with `送信待ち` and `破棄`.

## How to get to it (user POV)

- After login, the app opens `http://127.0.0.1:5173/`.
- Choose the sidebar link `メモ一覧`.
- On the page, choose the tab `メモ`.

## Driving it with the browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user. If `ログイン` is showing, run the dev-login recipe first.
- For `list-filter`, at least two memos with different tags exist. Create them with the create-memo recipe and pick the tag in the composer.

- **Open the list.** Go to `http://127.0.0.1:5173/`. The heading reads `メモ一覧` and the tab `メモ` is selected.
- **Empty state.** When the user has no memos, the page shows `まだメモがありません`.
- **Filter on.** Choose the button whose name starts with `つぶやき`. Its `aria-pressed` is true and only memos with that tag show. Choose a second tag button, such as `技術`. Both are pressed and memos with either tag show. The list does not narrow to the last tag.
- **Filter off.** Choose a pressed tag button again. It is no longer pressed and its memos leave the list unless another selected tag still matches.
- **Filter reset.** Choose the button whose name starts with `すべて`. No tag is pressed and every memo shows. Its count is the total number of memos.
- **Bulk delete.** Choose the checkbox `このメモを選択` on a fixture memo. The page shows `1件選択中`. Choose `削除`. The dialog asks whether to delete 1 memo. Choose `削除する`. The memo leaves the list. `キャンセル` closes the dialog and keeps the memo.
- **Pending card.** Make the page offline as described in the gotchas, then add a memo with the composer. The composer shows `オフラインです。メモは「つぶやき」として保存し、オンラインに戻ると自動で送信します。` A dashed card shows `つぶやき`, `送信待ち`, the text, and the button `破棄`. It has no checkbox and is not part of bulk delete. The server has no row for it. Choosing `破棄` removes it.
- **Filter on a pending card.** Press `技術` alone and the pending `つぶやき` card leaves. Press `つぶやき` as well and it returns.
- **Proof.** Save the snapshot to `artifacts/memo-list/list.aria.txt` and a screenshot to `artifacts/memo-list/list.png`. For a filter proof, the snapshot shows the pressed state of the tag buttons.

## Gotchas

- Filter and tag buttons include the count in the accessible name, such as `すべて 0`. Match the label prefix, not the whole string.
- The tag buttons are always `すべて`, `つぶやき`, `技術`, `やること`, `予定`, `その他`, in that order. `すべて` does not carry `aria-pressed`.
- Changing a tag, changing the search, or choosing `すべて` clears the card selection.
- With no search text, a tag filter that matches nothing shows `まだメモがありません`. That is the same copy as the empty state, so check the tag buttons before reading it as an empty account.
- `日報を追加` and `グループに追加` appear with a selection. Their recipes are in [daily-reports.md](./daily-reports.md) and [groups.md](./groups.md). They are disabled offline.
- The in-app browser has no switch for going offline. Emulate it in the page, and say so in the notes. Run `Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}); window.dispatchEvent(new Event('offline'))`. That alone is not enough, because the queued memo is sent at once over the live connection. Also run `window.__origFetch=window.fetch; window.fetch=()=>Promise.reject(new TypeError('Failed to fetch'))`. Restore with `window.fetch=window.__origFetch`. A full page load clears both. Do not dispatch `online` while a fixture is pending, because that sends it.
- `オフラインのため既存のメモは表示できません` appears when the list fetch is paused. It means the server list is hidden. Stop.
