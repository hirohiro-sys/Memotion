# Daily reports

The user selects memos on the memo list and creates a daily report from them. A draft is written by Workers AI. The user edits it, saves a draft, confirms it, or deletes it. A report is unique for one date and one kind, work or personal. The list page shows a table by date, and the calendar shows the reports of the selected day.

## Sub-features

- `dr-nav` opens `/daily-reports` from the sidebar link `日報`.
- `dr-list-empty` shows `日報はまだありません` and `今日の生成はあと N 回` when there are none.
- `dr-create-open` enables `日報を追加` for a selection and opens the dialog.
- `dr-create-ineligible` refuses a memo that is in a group, before any AI call. The memo tab hides grouped memos, so this cannot be proven from the screen.
- `dr-create-generate` creates a draft with AI and opens the editor. This needs Workers AI.
- `dr-create-fail` shows an error toast and saves no row when generation fails.
- `dr-dedupe` opens the existing report when the date and kind already have one.
- `dr-edit-save` saves the body with `一時保存`.
- `dr-edit-confirm` confirms with `確定` and returns to the list.
- `dr-delete` deletes the report and keeps the memos.
- `dr-list-grid` shows the date by work and personal table with state links.
- `dr-calendar-day` shows the reports on the calendar under `この日の日報`.
- `dr-append` adds memos that are not in the report yet with `足す`. This needs Workers AI.

## How to get to it (user POV)

- Sidebar link `日報`, or `http://127.0.0.1:5173/daily-reports`.
- On the memo list, check `このメモを選択` and choose `日報を追加`.
- On the calendar, choose a day and open a link under `この日の日報`.

## Driving it with the browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user.
- Part A needs nothing else. Part B needs Workers AI, which `wrangler dev` reaches through the Cloudflare account. Run `pnpm --filter @repo/api exec wrangler whoami` first. If it does not show a signed-in account, report Part B as not reachable with that reason.
- A fixture memo `verify-memotion-dr` exists and is not in a group. Use a fixture, never a real memo. Its text is sent to Cloudflare and uses the account's allowance.

Part A, no AI:

- **List.** Choose the link `日報`. The page shows `今日の生成はあと 2 回` when none is used today. With no reports it also shows `日報はまだありません`. With reports it shows a table with the headings `日付`, `仕事`, `個人`, one row per date, and a link such as `10月28日（水） 仕事 確定` in the cell of its kind. A cell with no report shows `—`. The local database can already hold reports from earlier use. Treat them as the user's data and only read them.
- **Open the editor.** Choose a report link. The URL becomes `/daily-reports/<id>`. The page shows the link `日報一覧`, a combobox for the framework whose name is its selected value (`実績` or `記録`), the textbox `本文`, and the buttons `削除`, `一時保存`, and `確定`. Do not press any of them on a report you did not create.
- **Enable.** On the memo list check `このメモを選択`. The page shows `1件選択中` and `日報を追加` is enabled. With 91 or more selected it is disabled with the title `メモは90件までです`.
- **Dialog.** Choose `日報を追加`. The dialog has a textbox `日付` that starts at today, and two comboboxes whose names are their selected values, `仕事` (the kind) and `実績` (the framework). Setting the kind to `個人` moves the framework to `記録`. `キャンセル` closes it.

Part B, with AI:

- **Generate.** Select `verify-memotion-dr`, choose `日報を追加`, keep the defaults, and choose `作成`. The button is busy and the dialog cannot close for up to 90 seconds. Do not treat the wait as a failure. On success the URL becomes `/daily-reports/<id>` and the page shows the state `下書き` and a textbox `本文` that starts with a heading line and the generated text.
- **Stored.** Run `curl -sS -b .agents/skills/verify-memotion/run/cookies.txt http://127.0.0.1:5173/api/daily-reports` and save the body to `artifacts/daily-reports/reports.json`. Then run `pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --local --command "SELECT id, report_date, kind, framework, status FROM daily_reports"` and save the output to `artifacts/daily-reports/d1.txt`. Do not add `--remote`.
- **Save.** Edit the textbox `本文` and choose `一時保存`. The toast says `保存しました。` and the state stays `下書き`.
- **Confirm.** Choose `確定`. The app returns to `/daily-reports` and the cell link reads the date, the kind, and `確定`.
- **Duplicate.** Select a second fixture memo and create a report with the same date and kind. No error toast shows. The app opens the existing report and offers `足す` for the memo that is not in it yet. No AI call is made until `足す` is chosen.
- **Calendar.** On `/calendar` select that day. Under `この日の日報` a link opens the editor. A day without a report shows `この日の日報はありません`.
- **Proof.** Save a snapshot and a screenshot of the editor and the list to `artifacts/daily-reports/`.
- **Remove the fixtures.** Choose `削除` and `削除する` in the dialog `この日報を削除しますか？`. The app returns to the list and the row is gone. The memos stay. Delete the report first and the memos after. The day's generation count does not come back.

Failure path, when AI is not reachable:

- After `作成` the dialog stays on the memo list, `作成` is enabled again, and a toast says `日報を生成できませんでした。`. No report row is added and the count in `daily_report_ai_uses` goes back. The log `run/api.log` has `{"event":"daily_report.generate","status":"failed","reason":"upstream",...}` and `POST /api/daily-reports 502`.
- Observed on 2026-11-04 with a signed-in Cloudflare account, twice: the call ran about 90 seconds and failed with `upstream`. Right after the request, `run/api.log` showed `Error: internal error; reference = ...` three times, which is the remote Workers AI call failing on the Cloudflare side. The model `@cf/google/gemma-4-26b-a4b-it` was in the account catalog (`wrangler ai models list`). The success path was not reached. When that happens, report Part B as not proven and say the failure path was. Do not retry in a loop, because each try costs 90 seconds.

## Gotchas

- A memo that is in a group does not show on the memo tab, so the screen never offers it for a report. Do not call the refusal verified from the UI.
- A report row can only be made by AI success. If AI is not reachable, report Part B as skipped with the reason. Do not make a row through the API or the database and call the UI path proven.
- Generation is limited to 2 per day in Japan time. Each success uses one, and `足す` uses one. Check the count with `SELECT used_on, count FROM daily_report_ai_uses` after the run.
- Toasts disappear. Take the snapshot right after the action.
- The default date is the memos' creation day in Japan time when all selected memos share it, otherwise today. Check the date before choosing `作成`.
- The notice about memos not yet in the report shows only right after the move to the editor and is lost on reload. Check `足す` straight after the duplicate step.
- Offline, the list shows `オフラインのため日報は表示できません`. That is not a pass. Stop.
