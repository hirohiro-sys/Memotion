# Memo search

Memo search narrows the memo list by what the user types. It matches the memo text, its link, and the date and time shown on a schedule card. It works together with the tag buttons and also applies to memos that are waiting to be sent.

## Sub-features

- `search-text` matches the memo text and its link, ignoring case.
- `search-schedule-line` matches the date and time printed on a schedule card, or `時間未定`.
- `search-and-filter` applies the tag filter first, then the search, so both must match.
- `search-none` shows `検索結果が見つかりません` when nothing matches.
- `search-clear` empties the box with `検索をクリア` and restores the list.
- `search-pending` applies the same search to a memo that is waiting to be sent.

## How to get to it (user POV)

- On the memo list, type in the searchbox `メモを検索`.

## Driving it with the browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user and the memo tab is open.
- A fixture memo with the text `verify-search` exists, and a schedule memo with the text `verify-search-schedule` exists. Create them with the create-memo and schedule recipes. Read the date and time printed on the schedule card with a snapshot before choosing a search word. Do not guess the weekday.

- **Text.** Fill `メモを検索` with `verify-search`. The fixture memo stays and memos without that text leave.
- **Schedule line.** The schedule card prints a line like `11月13日（金） 09:00`. Fill the searchbox with `11月13日` and the card stays. Fill `（金）` and `09:00` one at a time, and each keeps it. Fill the whole line with one half-width space between date and time and it stays.
- **No time.** A schedule without a time prints `時間未定`. Searching `時間未定` keeps it, and `09:00` does not.
- **Not matched on purpose.** `2026-11-13`, `11月03日` style zero padding, and half-width parentheses show `検索結果が見つかりません`. That is the design.
- **None.** Fill `検索に一致しない文言`. The page shows `検索結果が見つかりません`.
- **Search with a tag.** Choose `予定` and search the text of a `つぶやき` memo. The page shows `検索結果が見つかりません`, because both the tag and the text must match.
- **Clear.** Choose `検索をクリア`. The searchbox is empty and the list returns.
- **Pending card.** Go offline as described in [memo-list.md](./memo-list.md), then add a `つぶやき` memo with the text `verify-search-pending`. Search its text and the dashed card stays. Search a date such as `11月13日` and the dashed card leaves, because it has no date.
- **Proof.** Save the snapshot to `artifacts/memo-search/search.aria.txt` and a screenshot to `artifacts/memo-search/search.png`. Both show the searchbox value and the heading `メモ一覧`.

## Gotchas

- The date on the card has no year, no zero padding, full-width parentheses, and one half-width space before the time. A word copied from the database or from an ISO date does not match.
- Only schedule memos match on date and time. A memo of another tag that has a date does not.
- Typing in the search clears any card selection.
- With no search text, a tag filter that matches nothing shows `まだメモがありません`. With search text it shows `検索結果が見つかりません`.
- Search does not create or delete memos. A proof that only searches must not claim a new row.
- Tag and `すべて` button names carry a count. Match the label prefix.
