# App menu

The button `メニュー` at the top right of the entry screen opens the theme switch, the install guide, and log out.

## Sub-features

- `menu-theme` switches between light and dark.
- `menu-install` opens the dialog `アプリとして使う`.
- `menu-logout` logs out and opens the login page, after a confirmation when unsent memos exist.

## How to get to it (user POV)

- On the entry screen, choose the button `メニュー`.

## Driving it with the browser

Preconditions:

- `doctor.sh` exits 0.
- The textbox `メモを入力...` is visible.

- **Open.** Choose `メニュー`. The menu items `ダークモードにする` (or `ライトモードにする`), `アプリとして使う`, and `ログアウト` appear.
- **Theme.** Choose `ダークモードにする`. The page turns dark. Open the menu again and choose `ライトモードにする` to restore it.
- **Install guide.** Choose `アプリとして使う`. A dialog with `iPhone（Safari）`, `Mac（Safari）`, and `Mac（Chrome）` opens. Choose `閉じる`.
- **Log out.** Choose `ログアウト`. With no unsent memo, the URL becomes `/login`. With unsent memos, the dialog `未送信のメモがN件あります` appears first, with `キャンセル` and `破棄してログアウト`.
- **Proof.** Save the open menu snapshot to `artifacts/app-menu/menu.aria.txt` and a screenshot to `artifacts/app-menu/menu.png`.

## Gotchas

- Log out ends the dev session. Choose `開発用ログイン` on `/login` to come back.
- `破棄してログアウト` deletes the unsent memos on this device. Do not choose it with memos you want to keep.
- The menu fades in. Wait a moment before the screenshot.
