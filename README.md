# Memotion

LINE を活用した、個人用のインタースティシャルジャーナリングです。

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
│   │       ├── features/    # auth / line / memos / notifications
│   │       ├── lib/         # session, LINE I/O
│   │       └── db/
│   └── web/
│       └── src/
│           ├── routes/
│           ├── features/    # auth / memos / notifications
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
| [docs/backend-setup.md](docs/backend-setup.md) | Workers / D1 / R2、同一オリジン公開、CI |
| [docs/design-system.md](docs/design-system.md) | UI スタイル                       |


