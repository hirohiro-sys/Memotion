---
name: verify-memotion
description: "Drive the Memotion web app in a local browser and prove a user-visible change with a snapshot, a screenshot, and the saved memo row. Use when a change touches login, the memo list, memo creation, groups, or settings."
---

# Verify Memotion

Memotion's primary surface is the web UI at `http://127.0.0.1:5173`. The API is the local Worker at `http://127.0.0.1:8787`. LINE webhook and Messaging are a second surface; this skill does not drive them.

One verification run owns ports 5173 and 8787 and the persisted local D1. A second instance cannot run beside it. If either port is already taken, stop. Do not drive that process and do not kill it by name.

## Launch

From the repo root, with `apps/api/.dev.vars` present, `SESSION_SECRET` non-empty, and `APP_URL=http://127.0.0.1:5173`:

```bash
.cursor/skills/verify-memotion/scripts/launch.sh
```

The script applies local D1 migrations, starts the API with `wrangler dev --local` and the web app with Vite, and opens a dev session. Ready means all of these are true:

- `apps/api/wrangler.toml` has no `remote = true` (a remote binding would write the dev user into production).
- `http://127.0.0.1:8787/api/health` returns `{"status":"ok"}`.
- The API log line for `env.DB` says `local`.
- `http://127.0.0.1:5173/login` returns 200. The HTML shell does not contain `開発用ログイン`; the browser renders that link from the dev bundle.
- `GET /api/me` with `.cursor/skills/verify-memotion/run/cookies.txt` returns `{"id":"usr_dev_local"}`.

`wrangler d1 migrations apply` can print success and then stay running. The launch script stops that migrate process after the success line. It does not wipe the local D1. Tags come from migrations. The dev user row is created by `GET /api/auth/dev`.

## Doctor

```bash
.cursor/skills/verify-memotion/scripts/doctor.sh
```

Read-only. Exit 0 means this run's API and web processes are up, the D1 binding is local, and the dev session cookie is valid. Run it before driving whenever something looks off. Do not drive a failure.

## Drive

Use the Cursor browser. Prefer the accessible name over coordinates. The feature map is `.cursor/skills/verify-memotion/features/`. Read `features/README.md`, then the one feature file. Browser steps in those files are the user path. `curl` against `http://127.0.0.1:5173` with the cookie jar is only the second view of a row the browser already saved.

Dev login, from the login page, is the link named `開発用ログイン` (`href="/api/auth/dev"`). It sets the `sid` cookie and redirects to `/`. The same cookie attributes as LINE login apply (`HttpOnly`, `SameSite=Lax`). That link exists only while Vite is in dev. The route itself returns 404 unless both the request URL and `APP_URL` are `http` on `127.0.0.1`, `localhost`, or `[::1]`.

Stable handles:

| What the user sees | Handle |
| --- | --- |
| LINE login | button `LINEでログイン` |
| Dev login | link `開発用ログイン` |
| Memo list heading | heading `メモ一覧` |
| Search | searchbox `メモを検索` |
| Add memo | button `追加` |
| Memo body | textbox `メモを入力...` (the placeholder is the name) |
| Save memo | button `送信` |
| Empty list | text `まだメモがありません` |
| Memo tab / group tab | tab `メモ` / tab `グループ` |
| New group | button `新しいグループを作る` |
| Group name | textbox `グループの名前` |
| Create group | button `作成` |
| Settings | link `設定` (sidebar). On a narrow window, button `メニューを開く` reveals it |
| Logout | button `ログアウト` |
| Select a memo | checkbox `このメモを選択` |

## Evidence

Write proof under `.cursor/skills/verify-memotion/artifacts/<feature-id>/`. Cleanup must not delete this directory.

For a UI proof, save the ARIA snapshot and a screenshot that shows the Memotion heading and the result of the action. Also save the side effect: `curl -sS -b .cursor/skills/verify-memotion/run/cookies.txt http://127.0.0.1:5173/api/memos` into `memos.json`. A local D1 read is the second stored view:

```bash
pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --local --command "SELECT id, content FROM memos WHERE content = 'verify-memotion'"
```

Never add `--remote`. A screenshot of the final screen alone is not proof. The snapshot must show the action's result, and `memos.json` must contain the same text.

Do not mock the API. Do not prove a create by calling `POST /api/memos` yourself. Offline copy `オフラインのため既存のメモは表示できません` means the list is not the server list; stop.

## Cleanup

After the proof artifacts are on disk, remove only the fixture memo this run created (select it, `削除`, then `削除する`), then:

```bash
.cursor/skills/verify-memotion/scripts/cleanup.sh
```

The script signals the process groups it started and deletes `.cursor/skills/verify-memotion/run/`. It does not delete `artifacts/`, and it does not delete the local D1.

## Helpers

- `.cursor/skills/verify-memotion/scripts/launch.sh` starts one isolated local stack and the dev session.
- `.cursor/skills/verify-memotion/scripts/doctor.sh` checks that stack.
- `.cursor/skills/verify-memotion/scripts/cleanup.sh` stops that stack.
