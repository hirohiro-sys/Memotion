# Groups

Groups lets the user leave the memo list, see their groups, and create a named group.

## Sub-features

- `groups-open` opens the group tab.
- `groups-empty` shows the empty state when the user has no groups.
- `groups-create` saves a new group name and shows it.

## How to get to it (user POV)

- On the memo page, choose the tab `グループ`.
- Open `http://127.0.0.1:5173/?view=groups`.

## Driving it with the Cursor browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user.
- No group is named `verify-group`.

- **Open groups.** Choose the tab `グループ`. The URL contains `view=groups`. With no groups, the page shows `まだグループがありません` and the button `新しいグループを作る`.
- **Create.** Choose `新しいグループを作る`. Fill the textbox `グループの名前` with `verify-group` and choose `作成`. The list shows `verify-group`.
- **Proof.** Save the snapshot to `artifacts/groups/list.aria.txt` and a screenshot to `artifacts/groups/list.png`. Both show `verify-group`.
- **Remove the fixture.** After those files exist, open `verify-group`, choose the button `グループの操作`, choose `グループを削除`, then choose `削除する`. The list no longer shows `verify-group`. Leave the artifact files in place.

## Gotchas

- The group tab is a link named `グループ`, not a memo filter pill.
- `作成` stays disabled until the name has a non-whitespace character. A duplicate name shows `同じ名前のグループがあります`.
- Offline, group actions are unavailable. Do not treat a disabled `新しいグループを作る` as a passed empty state.
