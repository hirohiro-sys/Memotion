# Create a memo

Create a memo lets the user type a note on the entry screen and send it. The screen keeps only the composer and the memos not yet sent. Sent memos are read in Notion, not on this screen.

## Sub-features

- `create-save` sends the text, shows the toast `保存しました`, and clears the textbox.
- `create-schedule` sends a `予定` memo with a date and an optional time.
- `create-offline` keeps a memo as a `送信待ち` card while offline and sends it when the browser is back online.
- `create-stored` shows the same text in the local database.

## How to get to it (user POV)

- Open `http://127.0.0.1:5173/`. The textbox `メモを入力...` has focus.

## Driving it with the browser

Preconditions:

- `doctor.sh` exits 0.
- The textbox `メモを入力...` is visible.
- No memo already contains the exact text `verify-memotion`.

- **Enter text.** Choose the tag button `技術`, then fill the textbox `メモを入力...` with `verify-memotion`. The button `送信` is enabled.
- **Save.** Choose `送信`, or press Command/Ctrl+Enter in the textbox. The toast `保存しました` appears, the textbox is empty, and the tag `技術` stays selected.
- **Schedule.** Choose `予定`. The fields `日付` and `時刻（任意）` appear, with today's date. Fill the textbox with `verify-schedule` and choose `送信`. The toast `保存しました` appears and the textbox is empty.
- **Offline.** Put the browser offline. The notice `オフラインです。…` appears and the tag buttons are hidden. Send `verify-offline`. The heading `未送信のメモ 1件` and a dashed card with `送信待ち` appear. Put the browser back online. The toast `保存しました` appears and the card is gone.
- **Confirm the rows.** Run `pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --local --command "SELECT id, content, tag_id, scheduled_date FROM memos WHERE content LIKE 'verify-%'"` and save the output to `artifacts/create-memo/d1.txt`. It has the three rows, with `tag_tech`, `tag_schedule` and today's date, and `tag_tweet`. Do not add `--remote`.
- **Proof.** Save the snapshot to `artifacts/create-memo/entry.aria.txt` and a screenshot with the toast to `artifacts/create-memo/entry.png`.
- **Remove the fixtures.** The screen has no delete. After the files exist, run `pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --local --command "DELETE FROM memos WHERE user_id = 'usr_dev_local' AND content IN ('verify-memotion', 'verify-schedule', 'verify-offline')"`. Leave the artifact files in place.

## Gotchas

- `送信` stays disabled until the textbox has non-whitespace text.
- Do not prove this feature by posting to `POST /api/memos`. That skips the composer the user uses.
- Enter alone adds a line break. Pressing Enter while the IME is converting does not send.
- A normal memo goes through the device queue before the server. The toast comes from the queue sender after the server saves it, so the empty textbox alone is not proof.
- A `予定` memo is sent directly, not queued. Offline, the composer drops the `予定` choice and shows `オフラインのため予定は登録できません`.
- A past date shows `過去の日付は選べません` and keeps `送信` disabled.
- Turning the browser's network off in DevTools fires the `offline` event. A page script that only stubs `fetch` does not, and the notice does not appear.
