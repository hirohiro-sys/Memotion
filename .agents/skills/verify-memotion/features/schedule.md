# Schedule and calendar

A schedule is a memo with the tag `予定`. It has a required date and an optional time, both in Japan time. The calendar page shows a month grid. Choosing a day shows that day's schedules, the memos written that day, and that day's daily reports.

## Sub-features

- `schedule-create` saves a memo with the tag `予定`, a date, and an optional time from the composer.
- `schedule-convert` turns a `つぶやき` memo into a schedule with `予定にする`. It cannot be undone.
- `schedule-edit` changes the date and time with `日時を変更`, and `時間未定にする` clears the time.
- `schedule-validation` refuses a past date and an empty date.
- `schedule-delete` deletes a schedule from the calendar after a confirmation.
- `cal-open` opens `/calendar` on the current month with today selected.
- `cal-nav` moves the month with `前の月`, `次の月`, and `今日`.
- `cal-dot` marks a day that has a schedule with `、予定あり` in the day button's name.
- `cal-day-panel` shows `M月D日（曜）の予定`, `この日のメモ`, and `この日の日報` for the selected day.
- `schedule-stored` shows the date and time in the API and the local database.

## How to get to it (user POV)

- Sidebar link `カレンダー`, or `http://127.0.0.1:5173/calendar`.
- On the memo list, choose `追加`, then the tag `予定`.
- On a `つぶやき` card, choose `予定にする`. On a schedule card, choose `日時を変更`.

## Driving it with the browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user.
- No memo contains `verify-schedule`.
- Get the dates in Japan time with `TZ=Asia/Tokyo date +%F` and `TZ=Asia/Tokyo date -v+1d +%F`. Call them TODAY and TOMORROW. The app judges dates in Japan time whatever the browser clock says.

- **Create.** On the memo list choose `追加`, then the tag `予定`. Two inputs appear. The date input is a textbox of type date whose accessible name is its current value, so it reads as today, such as `2026-11-04`. The time input is a textbox of type time with no name. Set the date to TOMORROW and the time to `10:30` with the form-fill tool, not by typing. Fill the textbox `メモを入力...` with `verify-schedule` and choose `送信`. The list shows a card with the badge `予定` and the line for TOMORROW and `10:30`.
- **Calendar.** Choose the sidebar link `カレンダー`. The URL is `/calendar` and the heading reads the current year and month. The button for today is pressed and the panel heading is today's `の予定`. Choose the day button named TOMORROW with `、予定あり`. Go to `次の月` first when TOMORROW is in the next month. The panel lists `10:30` and `verify-schedule` with `日時を変更` and `削除`. The headings `この日のメモ` and `この日の日報` show below. The schedule itself is not under `この日のメモ`.
- **Edit.** Choose `日時を変更`. The dialog has a date textbox and a time textbox, both named by their current values (`2026-11-05` and `10:30`), then the buttons `時間未定にする`, `キャンセル`, and `保存`. Choose `時間未定にする` and `保存`. Wait about two seconds. The row shows `時間未定` and the API returns no time.
- **Validation.** Open `日時を変更` again and set the date to yesterday. The dialog says `過去の日付は選べません` and `保存` is disabled. Choose `キャンセル`.
- **Convert.** Create a `つぶやき` memo `verify-schedule-convert`. Choose `予定にする` on its card. The dialog says a date is required, a time is optional, and a schedule cannot go back to a tweet. Set a date and choose `予定にする` in the dialog. The badge becomes `予定` and the card button becomes `日時を変更`.
- **Stored.** Run `curl -sS -b .agents/skills/verify-memotion/run/cookies.txt http://127.0.0.1:5173/api/memos` and save the body to `artifacts/schedule/memos.json`. The memo has the tag `schedule` with the date and, when set, the time. Then read the row from the local database with `pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --local --command "SELECT * FROM memos WHERE content LIKE 'verify-schedule%'"`, saving the output to `artifacts/schedule/d1.txt`. Do not add `--remote`.
- **Proof.** Save the calendar snapshot to `artifacts/schedule/calendar.aria.txt` and a screenshot to `artifacts/schedule/calendar.png` showing the sidebar and the selected day.
- **Remove the fixtures.** After those files exist, on `/calendar` select the day, choose `削除` on the `verify-schedule` row and `削除する` in the dialog `この予定を削除しますか？`. The row leaves and `、予定あり` leaves the day button when it was the only one. Remove `verify-schedule-convert` the same way, or select it on the memo list and use `削除`, then `削除する`.

## Gotchas

- After `保存` or `削除する` the panel updates about a second later. A snapshot taken at once still shows the old row, so wait about two seconds and read the API before calling it a failure.
- `次の月` and `前の月` change the grid heading, such as `2026年12月`, and keep the selected day and its panel. `今日` returns to the current month and selects today.
- The selected day and month live in the page only. A reload goes back to today in Japan time.
- The dot on a day is hidden from the accessibility tree. Read `、予定あり` in the button name, or look at the screenshot.
- Only a `つぶやき` memo that is not in a group can become a schedule. Other tags show no `予定にする`. A server refusal shows `このメモは予定にできません。`.
- A schedule cannot go into a group. In a bulk add to a group it is skipped.
- The server refuses a past date with `schedule_date_past`. Today is allowed whatever the time. A time with no date is not allowed.
- Do not prove a create by posting to the API. Use the composer.
- Offline, saving, changing and deleting are disabled, and the composer drops the `予定` tag with `オフラインのため予定は登録できません`.
- The LINE push the day before a schedule cannot be observed locally. Only the note under the date field, the sidebar row `予定の前日通知`, and the switch in settings are on screen. Do not change the notification switch for this check.
- `この日のメモ` is by the day a memo was written, so a new memo shows under today even when its schedule date is another day.
