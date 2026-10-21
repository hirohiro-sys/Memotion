# Create a memo

Create a memo lets the user type a note on the memo list, save it, and see that same note in the list.

## Sub-features

- `create-open` opens the composer from the add button.
- `create-save` saves the text and shows it in the list.
- `create-cancel` closes the composer without a new memo.
- `create-stored` shows the same text from the API and the local database.

## How to get to it (user POV)

- On the memo list, choose the button `追加`.

## Driving it with the Cursor browser

Preconditions:

- `doctor.sh` exits 0.
- The heading `メモ一覧` is visible.
- No memo already contains the exact text `verify-memotion`.

- **Open the composer.** Choose the button `追加`. A textbox named `メモを入力...` appears, with a button `送信` and a button `キャンセル`.
- **Enter text.** Fill the textbox `メモを入力...` with `verify-memotion`. The button `送信` is enabled.
- **Save.** Choose `送信`. The composer closes and the list shows `verify-memotion`. `まだメモがありません` is gone.
- **Confirm the row.** Run `curl -sS -b .cursor/skills/verify-memotion/run/cookies.txt http://127.0.0.1:5173/api/memos` and save the body to `artifacts/create-memo/memos.json`. It contains `verify-memotion`. Then run `pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --local --command "SELECT id, content FROM memos WHERE content = 'verify-memotion'"` and save the output to `artifacts/create-memo/d1.txt`. The row's content is `verify-memotion`. Do not add `--remote`.
- **Proof.** Save the list snapshot to `artifacts/create-memo/list.aria.txt` and a screenshot to `artifacts/create-memo/list.png`. Both show `verify-memotion` and the heading `メモ一覧`.
- **Remove the fixture.** After those files exist, choose the checkbox `このメモを選択` on that memo, choose `削除`, then choose `削除する`. The list no longer shows `verify-memotion`. Leave the artifact files in place.

## Gotchas

- `送信` stays disabled until the textbox has non-whitespace text.
- Do not prove this feature by posting to `POST /api/memos`. That skips the composer the user uses.
- Cancelling with `キャンセル` must leave no `verify-memotion` row. A cancelled draft is not a save.
- The default tag is `つぶやき`. The saved card shows that label.
- If the empty-state copy is `オフラインのため既存のメモは表示できません`, the save did not reach the server. Stop.
