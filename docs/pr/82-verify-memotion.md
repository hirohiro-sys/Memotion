## 課題

エージェントが LINE ログインと本番の D1 なしでは、メモ一覧が開いたことを確認できなかった。対応する issue は #82。プランは無い。

メモの送信とグループ名の確定は、ボタンを押す必要があった。`n` で作成ダイアログを開く案は、OS の検索に当たるので採用しない。

## 解決策

ローカルの http ループバックだけに、固定ユーザー `usr_dev_local` のセッションを発行する入口を足した。`wrangler.toml` の D1 と R2 は手元に繋ぐ。画面を起動し、操作し、証拠を残す手順は `.cursor/skills/verify-memotion/` に置いた。

本番の `https` ではこの入口は 404 になる。`remote = true` に戻すと、同じ入口が本番の `users` に行を足す。

メモの入力欄は、本文があるとき ⌘ / Ctrl+Enter が「送信」と同じ処理になる。Enter だけは改行。変換中、空欄、送信中は送らない。

グループ名の入力欄は、名前があるとき ⌘ / Ctrl+Enter が送信ボタンと同じ処理になる。作成では「作成」、名前の変更では「変更」。ダイアログを開くのは今までどおりボタン。名前欄は一行なので、Enter だけでもフォームが送信される。グループ内メモの ⌘ / Ctrl+Enter は変えていない。

## テスト

- `pnpm --filter @repo/api test` は 194 件通過（`dev-login.test.ts` を含む）。ショートカットのコミットより前。
- `pnpm lint` と `pnpm typecheck` は通過。ショートカットのコミットより前。このコミットのあとは未実行。
- `pnpm build` はクライアントの出力まで進んだあと、プロセスを止めた。Turborepo 上は完了していない。ショートカットのコミットより前。
- ブラウザで「開発用ログイン」からメモ一覧を開き、`verify-memotion` というメモを保存してローカル D1 に行があることを確認した。証拠は `.cursor/skills/verify-memotion/artifacts/create-memo/`（gitignore）。確認後にそのメモは削除した。
- 開発用ログイン、メモ一覧、グループ、設定は手順書だけを書き、画面での通し確認はしていない。
- ショートカットの自動テストは追加していない（Web だけの変更）。
- ブラウザでメモ入力に `verify-memotion` を入れて ⌘+Enter し、一覧と `GET /api/memos`、ローカル D1 に同じ本文があることを確認した。証拠は `.cursor/skills/verify-memotion/artifacts/shortcuts/`（gitignore）。
- ブラウザでグループ名 `chord-group` を入れて ⌘+Enter し、一覧にグループが出ることを確認した。この確認で残ったローカルの行（`verify-memotion`、`chord-group`）は消していない。
- 変換中に送らないことは、ブラウザでは未確認。`isComposing` のときは送信しない。

## レビュー観点

- `GET /api/auth/dev` が本番の Worker に載ること。ループバックかつ `APP_URL` が http のときだけ通る。
- `remote = true` を外したので、このブランチの `pnpm dev` は本番のメモを見ない。
- ローカルサーバーの起動中、他のページから `http://127.0.0.1:5173/api/auth/dev` へブラウザを飛ばせると、開発用ユーザーのセッションに切り替わる。相手に Cookie は渡らない。
- `memo-composer.tsx` の ⌘ / Ctrl+Enter が、空欄・送信中・変換中では送らず、Enter 単体は改行のままであること。
- `group-name-dialog.tsx` の同じキーが、作成と名前の変更の両方に効くこと。ページは `n` を見ていない。
- グループ内メモの入力（`group-memo-input.tsx`）は差分に含まれない。
- AI 相互レビューは未添付。
