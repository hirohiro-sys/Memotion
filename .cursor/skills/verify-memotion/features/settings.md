# Settings

Settings shows the signed-in user's notification switches and lets them log out.

## Sub-features

- `settings-open` opens the settings page.
- `settings-weekly` shows the weekly tech notification control.
- `settings-logout` returns to the login page.

## How to get to it (user POV)

- Choose the sidebar link `設定`.
- On a narrow window, choose `メニューを開く`, then `設定`.
- Open `http://127.0.0.1:5173/settings` while signed in.

## Driving it with the Cursor browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user.

- **Open settings.** Choose the link `設定`, or go to `http://127.0.0.1:5173/settings`. The heading reads `設定`. The page shows `技術の週次通知` and `TODOの毎日通知`, and the button `ログアウト`.
- **Proof.** Save the snapshot to `artifacts/settings/page.aria.txt` and a screenshot to `artifacts/settings/page.png`. Both show the heading `設定`.
- **Logout check.** Choose `ログアウト` only when the recipe is about leaving the session. The login page returns and `開発用ログイン` is visible again.

## Gotchas

- Both notification switches use the accessible name `オン` or `オフ`. There are two. A click that does not name which control changed is not proof.
- Logging out clears the browser session. The cookie jar in `run/cookies.txt` can still hold the old `sid` until the next launch. Do not mix a logged-out browser with that jar.
- Do not change the saved weekday or time during a proof that only checks the page opens.
