# Settings

Settings shows the signed-in user's three notification switches, the install guide, and the log out button. The LINE notification status and the dark mode button live in the sidebar, not on this page.

## Sub-features

- `settings-open` opens the settings page.
- `settings-weekly` shows the weekly tech notification control with its weekday buttons and time.
- `settings-todo` shows the daily TODO notification control and its time.
- `settings-schedule` shows the notification the day before a schedule and its time.
- `settings-pwa` shows the install guide `アプリとして使う`.
- `settings-sidebar-status` shows `LINE通知ステータス` and the dark mode button in the sidebar.
- `settings-logout` asks about unsent memos when there are any, then returns to the login page.

## How to get to it (user POV)

- Choose the sidebar link `設定`.
- On a narrow window, choose `メニューを開く`, then `設定`.
- Open `http://127.0.0.1:5173/settings` while signed in.

## Driving it with the browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user.

- **Open settings.** Choose the link `設定`, or go to `http://127.0.0.1:5173/settings`. The heading reads `設定`. Under the heading `通知` there are three switches for `技術の週次通知`, `TODOの毎日通知`, and `予定の前日通知`. Below are the heading `アプリとして使う`, and the button `ログアウト`.
- **Sidebar.** The sidebar shows the heading `LINE通知ステータス` with three rows, and a button `ダークモードに切り替える` at the bottom. Choosing it changes its name to `ライトモードに切り替える` and sets `aria-pressed`. Choose it again to restore the theme.
- **Proof.** Save the snapshot to `artifacts/settings/page.aria.txt` and a screenshot to `artifacts/settings/page.png`. Both show the heading `設定`.
- **Logout check.** Choose `ログアウト` only when the recipe is about leaving the session. With none unsent, the app goes straight to the login page and `開発用ログイン` is visible again. With unsent memos on this device a dialog titled `未送信のメモがN件あります` says `ログアウトすると、この端末の未送信のメモは破棄されます。` and offers `キャンセル` and `破棄してログアウト`. `キャンセル` stays on `/settings`. `破棄してログアウト` goes to `/login` and the device queue is empty. When the logout request fails, the toast says `ログアウトできませんでした。`, the page stays on `/settings`, and nothing is cleared.
- **Notification change.** Choose the third `オン` (the schedule switch). It becomes `オフ` and `GET /api/notifications` shows `scheduleDailyEnabled: false` with the other two unchanged. Choose it again to restore. Set the schedule time field to `21:00` and press Enter, and the API shows `scheduleDailyTime: "21:00"`. Set it back to `20:00`. Save the values before the check and compare after, because these are the user's own settings.
- **Install guide.** The three entries `iPhone（Safari）`, `Mac（Safari）`, and `Mac（Chrome）` are closed at first. Choosing one opens its steps.

## Gotchas

- All three notification switches use the accessible name `オン` or `オフ`, and three time fields share the name `時刻`. A click that does not name which control changed is not proof. Identify the switch by the section it sits in.
- Logging out clears the browser session. The cookie jar in `run/cookies.txt` can still hold the old `sid` until the next launch. Do not mix a logged-out browser with that jar.
- Do not change the saved weekday or time during a proof that only checks the page opens. Weekly and TODO changes are sent as soon as they are made.
- Turning the schedule switch on or changing its time after the notice time today means tomorrow's schedule is not notified that day. Run the notification check well before the set time.
- The dark mode choice is kept in the browser. Restore the original theme after a check.
- The LINE push that the notifications send cannot be observed locally. Only the screen state can be verified.
