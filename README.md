# Memotion

LINE を活用した、個人用のインタースティシャルジャーナリングです。LINE と Web から送ったメモを Notion のデータベースに残し、LINE に通知します。見返しは Notion で行います。

## 主な機能

- メモの投入: LINE のテキストとリンクを Notion に保存する。Web の 1 画面からも種類（タグ）と予定の日時を付けて送れ、オフライン中に書いたメモは復帰後に送る
- 通知: LINE の Push で、技術メモの週次ダイジェスト、TODO の日次、予定の前日を知らせる
- PWA: ホーム画面に追加して使う

## 技術スタック


| 層    | 技術                                                      |
| ---- | ------------------------------------------------------- |
| Web  | Vite, React 19, TanStack Router / Query, Tailwind CSS 4 |
| API  | Cloudflare Workers, Hono, Notion API, KV, Durable Objects |
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
│   │       ├── features/    # auth / line / memos / notifications
│   │       └── lib/         # session, JST, LINE I/O, Notion I/O
│   └── web/
│       └── src/
│           ├── routes/
│           ├── features/    # auth / memos / pwa / schedule
│           ├── components/
│           └── config/
├── packages/shared/         # API 契約の Zod
└── docs/
```



## 開発

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm dev
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`（Vite が `/api` をプロキシ）

LINE の設定なしでログインするには、ローカルで `http://127.0.0.1:8787/api/auth/dev` を開く（ループバックの http だけで有効。本番では 404）。メモを保存するには、`.dev.vars` に Notion のトークンとデータソース ID が要る。

環境変数・LINE・Notion・デプロイ・CI は [docs/backend-setup.md](docs/backend-setup.md)。

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
| [docs/backend-setup.md](docs/backend-setup.md) | Workers / Notion / KV、同一オリジン公開、Cron、CI |
| [docs/README.md](docs/README.md)               | docs の目次。開発フロー、チェックリスト、Design Doc、プラン |
| [apps/web/PRODUCT.md](apps/web/PRODUCT.md)     | プロダクトの目的と利用者                  |
| [apps/web/DESIGN.md](apps/web/DESIGN.md)       | UI スタイル                       |


