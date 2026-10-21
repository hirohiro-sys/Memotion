# Dev login

Dev login lets a person on this computer open Memotion without LINE and land on the memo list as the local user.

## Sub-features

- `dev-login-link` shows the dev entry on the local login page.
- `dev-login-enter` issues a session and opens the memo list.
- `dev-login-denied` leaves the public site without that session.

## How to get to it (user POV)

- Open `http://127.0.0.1:5173/login` and choose `開発用ログイン`.
- Open `http://127.0.0.1:5173/api/auth/dev` directly. The server redirects to the memo list.

## Driving it with the Cursor browser

Preconditions:

- `doctor.sh` exits 0, or the stack is up and the browser has no `sid` yet.
- The address bar is `http://127.0.0.1:5173`, not a LAN hostname.

- **Open login.** Go to `http://127.0.0.1:5173/login`. The heading reads `Memotion` and the link `開発用ログイン` is visible. The button `LINEでログイン` is also visible.
- **Enter.** Choose `開発用ログイン`. The URL becomes `http://127.0.0.1:5173/` and the heading reads `メモ一覧`.
- **Confirm the session.** Read `GET /api/me` with `.cursor/skills/verify-memotion/run/cookies.txt`. The body is `{"id":"usr_dev_local"}`.
- **Proof.** Save the memo-list snapshot to `artifacts/dev-login/list.aria.txt` and a screenshot to `artifacts/dev-login/list.png`. Both show the heading `メモ一覧`.

## Gotchas

- `開発用ログイン` is rendered only by `vite dev`. A production build of the login page does not show it. The route still answers only for an `http` loopback.
- A session cookie from the normal window is not present in a private window. Choose `開発用ログイン` again there.
- `LINEでログイン` leaves this local proof and depends on LINE. Do not use it as the dev entry.
