## 課題

エージェントが LINE ログインと本番の D1 なしでは、メモ一覧が開いたことを確認できなかった。対応する issue は #82。プランは無い。

## 解決策

ローカルの http ループバックだけに、固定ユーザー `usr_dev_local` のセッションを発行する入口を足した。`wrangler.toml` の D1 と R2 は手元に繋ぐ。画面を起動し、操作し、証拠を残す手順は `.cursor/skills/verify-memotion/` に置いた。

本番の `https` ではこの入口は 404 になる。`remote = true` に戻すと、同じ入口が本番の `users` に行を足す。

## テスト

- `pnpm --filter @repo/api test` は 194 件通過（`dev-login.test.ts` を含む）。
- `pnpm lint` と `pnpm typecheck` は通過。
- `pnpm build` はクライアントの出力まで進んだあと、プロセスを止めた。Turborepo 上は完了していない。
- ブラウザで「開発用ログイン」からメモ一覧を開き、`verify-memotion` というメモを保存してローカル D1 に行があることを確認した。証拠は `.cursor/skills/verify-memotion/artifacts/create-memo/`（gitignore）。確認後にそのメモは削除した。
- 開発用ログイン、メモ一覧、グループ、設定は手順書だけを書き、画面での通し確認はしていない。

## レビュー観点

- `GET /api/auth/dev` が本番の Worker に載ること。ループバックかつ `APP_URL` が http のときだけ通る。
- `remote = true` を外したので、このブランチの `pnpm dev` は本番のメモを見ない。
- ローカルサーバーの起動中、他のページから `http://127.0.0.1:5173/api/auth/dev` へブラウザを飛ばせると、開発用ユーザーのセッションに切り替わる。相手に Cookie は渡らない。
- AI 相互レビューは未添付。
