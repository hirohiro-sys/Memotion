# Memotion verification map

This directory is the maintained source for verifying Memotion's user-facing web behavior. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `.agents/skills/verify-memotion/scripts/launch.sh` so the app is at `http://127.0.0.1:5173` and the API is at `http://127.0.0.1:8787`.
- `.agents/skills/verify-memotion/scripts/doctor.sh` exits 0 and reports `usr_dev_local`.
- Ports 5173 and 8787 are owned by that launch. Never drive an instance this run did not start.
- Memos go to the development Notion database in `apps/api/.dev.vars`. Never point it at the production database, and do not add `remote = true` to `wrangler.toml`.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or screen coordinates.
- Drive the browser as the user. Use `scripts/notion-read.mjs` only to read back a page the browser saved.
- Keep proof artifacts. Cleanup removes the `run/` directory, not `artifacts/` or the fixture pages in Notion.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot that shows the Memotion heading.
- Mutation proof is a Notion read of the same content. The entry screen has no list to read back.
- Record the feature ID and the entry point used with every artifact.
- Report an unreachable path with the attempted step and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with the browser` starts with `Preconditions:` and uses labeled bullets that pair each user action with the handle and the observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Dev login](./dev-login.md) opens the app as the local dev user.
- [Create a memo](./create-memo.md) sends a memo, a schedule, and an offline memo from the entry screen.
- [App menu](./app-menu.md) switches the theme, shows the install guide, and logs out.
