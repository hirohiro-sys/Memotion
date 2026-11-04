# Groups

Groups lets the user leave the memo list, see their groups, and create a named group.

## Sub-features

- `groups-open` opens the group tab.
- `groups-empty` shows the empty state when the user has no groups.
- `groups-create` saves a new group name and shows it.
- `groups-rename` renames a group from the actions menu.
- `groups-write` adds a memo from the box inside an open group.
- `groups-assign` selects memos on the memo tab and adds them to a group.
- `groups-delete` deletes a group and its memos after a confirmation.

## How to get to it (user POV)

- On the memo page, choose the tab `グループ`.
- Open `http://127.0.0.1:5173/?view=groups`.

## Driving it with the browser

Preconditions:

- `doctor.sh` exits 0.
- The browser session is the dev user.
- No group is named `verify-group`.

- **Open groups.** Choose the tab `グループ`. The URL contains `view=groups`. With no groups, the page shows `まだグループがありません` and the button `新しいグループを作る`.
- **Create.** Choose `新しいグループを作る`. Fill the textbox `グループの名前` with `verify-group` and choose `作成`. The URL gains `group=`. The group opens as a chat with the heading `verify-group` and `メモ 0件`. On a window 768px wide or more, the list on the left also shows `verify-group`. On a narrow window the list is hidden and only the chat heading shows it.
- **Write in the group.** In the textbox `メモを書く`, type `verify-group-memo` and press `送信` or Command/Ctrl+Enter. The memo shows as a bubble with its time and the heading reads `メモ 1件`. Enter alone adds a line break. The tag pills there have no `やること` and no `予定`.
- **Rename.** Choose `グループの操作`, then `名前を変更`. Fill `グループの名前` with `verify-group-2` and choose `変更`. The heading changes. A name over 50 characters is not accepted.
- **Assign from the memo tab.** On the memo tab, check `このメモを選択` on a fixture memo and choose `グループに追加`. The dialog lists the groups. Choose the group. A toast reports the result and the memo shows in that group.
- **Proof.** Save the snapshot to `artifacts/groups/list.aria.txt` and a screenshot to `artifacts/groups/list.png`. Both show the group name.
- **Remove the fixture.** After those files exist, open the group, choose the button `グループの操作`, choose `グループを削除`, then choose `削除する`. The confirmation says the memos in it are deleted and cannot be restored. The group is gone. Leave the artifact files in place.

## Gotchas

- The group tab is an element with role `tab` named `グループ`, inside a tablist next to the tab `メモ`. It is not a link and not a memo filter pill.
- `作成` stays disabled until the name has a non-whitespace character. A duplicate name shows `同じ名前のグループがあります`.
- Right after create, the new group is already open. A step that opens it again is only needed from the list.
- The button `新しいグループを作る` appears twice with one name: the empty-state card and the plus button next to the list heading. Only one is on screen at a time with no groups.
- Offline, the group tab shows only the sentence `オフラインのためグループは使えません` and renders no buttons. A missing `新しいグループを作る` is that state, not a passed empty state.
- A memo added to a group leaves the memo tab. The tag counts drop by one and the memo cannot be selected there any more. Confirm an assign by the group chat or `SELECT m.content, g.name FROM memos m LEFT JOIN groups g ON g.id = m.group_id`.
- Deleting a group deletes its memos. Delete the group last in a cleanup that also removes memos.
- A `group=` value that is not in the list shows the toast `グループが見つかりません` and returns to `?view=groups`. After a full page load the toast can be gone before it is read. Trigger it inside the page instead: `history.pushState({}, '', '/?view=groups&group=zzz-missing'); window.dispatchEvent(new PopStateEvent('popstate'))`, then poll for the text.
- On a window 768px wide or more, opening `?view=groups` opens the first group at once and the URL gains `group=`. On a 375px window only one side shows. The chat shows with the link `グループ一覧に戻る` (its name is an `aria-label`), and choosing it shows only the list. Check this with a screenshot, because a visibility query on the elements can mislead.
- The sidebar becomes a drawer on a narrow window. `メニューを開く` opens it with `メモ一覧`, `カレンダー`, `日報`, and `設定`.
- `日報を追加` and schedules are not available inside a group. A schedule memo skips the group in a bulk add.
