# Memotion

LINE を活用した、個人用のインタースティシャルジャーナリングです。LINE に残したメモを、種類ごとに整理して Web とモバイルで見返せます。

## 主な機能

- メモ: LINE のテキスト・画像・リンクを取り込み、種類（タグ）ごとに一覧・検索・編集する。Web からも作成でき、オフライン中の作成は復帰後に送る
- 予定とカレンダー: 予定（schedule）タグのメモを日付と時刻つきで管理し、月表示と日ごとのメモを見る
- グループ: メモをグループにまとめる
- 日報: 選んだメモから生成AI（Workers AI）で日報を書き、編集して残す
- 通知: LINE の Push で、技術メモの週次ダイジェスト、TODO の日次、予定の前日を知らせる
- PWA: ホーム画面に追加して使う

## 技術スタック


| 層    | 技術                                                      |
| ---- | ------------------------------------------------------- |
| Web  | Vite, React 19, TanStack Router / Query, Tailwind CSS 4 |
| API  | Cloudflare Workers, Hono, Drizzle, D1, R2               |
| 契約   | Zod（`packages/shared`）                                  |
| モノレポ | pnpm, Turborepo                                         |
| 品質   | Biome, Vitest                                           |


本番は同じ Worker が `/` に Web、`/api/*` に API を出す。

## 構成

```
.
├── apps/
│   ├── api/                 # Worker。本番は同一オリジンで Web も配信
│   │   └── src/
│   │       ├── features/    # auth / daily-reports / groups / line / memos / notifications
│   │       ├── lib/         # session, JST, LINE I/O
│   │       └── db/
│   └── web/
│       └── src/
│           ├── routes/
│           ├── features/    # auth / daily-reports / groups / memos / notifications / pwa / schedule
│           ├── components/
│           └── config/
├── packages/shared/         # API 契約の Zod
└── docs/
```



## 開発

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm --filter @repo/api db:migrate:local
pnpm dev
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`（Vite が `/api` をプロキシ）

LINE の設定なしでログインするには、ローカルで `http://127.0.0.1:8787/api/auth/dev` を開く（ループバックの http だけで有効。本番では 404）。日報の生成は Workers AI に繋ぐため、`wrangler.toml` の `[ai]` が `remote = true` になっている。

環境変数・LINE・D1 / R2・デプロイ・CI は [docs/backend-setup.md](docs/backend-setup.md)。

```bash
pnpm lint
pnpm typecheck
pnpm --filter @repo/api test
pnpm run deploy
```



## ドキュメント


| 文書                                             | 内容                            |
| ---------------------------------------------- | ----------------------------- |
| [docs/background.md](docs/background.md)       | なぜ LINE キープメモを使うか、現状の課題      |
| [docs/backend-setup.md](docs/backend-setup.md) | Workers / D1 / R2 / Workers AI、同一オリジン公開、Cron、CI |
| [docs/README.md](docs/README.md)               | docs の目次。開発フロー、チェックリスト、Design Doc、プラン |
| [apps/web/PRODUCT.md](apps/web/PRODUCT.md)     | プロダクトの目的と利用者                  |
| [apps/web/DESIGN.md](apps/web/DESIGN.md)       | UI スタイル                       |


