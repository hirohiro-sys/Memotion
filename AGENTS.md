# Memotion

LINEを用いた個人用のインタースティシャルジャーナリングツール。

## 技術スタック

| 層 | 技術 |
| --- | --- |
| Web | Vite, React 19, TanStack Router / Query, Tailwind CSS 4 |
| API | Cloudflare Workers, Hono, Drizzle, D1, R2 |
| 契約 | Zod（`packages/shared`） |
| モノレポ | pnpm, Turborepo |
| 品質 | Biome, Vitest |

## ディレクトリ構成

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
├── docs/
└── .cursor/                 # ファイル別ルール
```

## 主要コマンド（テスト、ビルド、リント）

`apps/` か `packages/` を変えたら、緑になるまで次を回す。ハーネスや docs だけの変更では回さない。コミットは指示があるまでしない。

```bash
pnpm lint
pnpm typecheck
pnpm --filter @repo/api test
pnpm build
```

| コマンド | 内容 |
| --- | --- |
| `pnpm lint` | Biome（`biome check .`） |
| `pnpm typecheck` | ワークスペース全体の型チェック |
| `pnpm --filter @repo/api test` | API の Vitest |
| `pnpm build` | Web と API のビルド |
| `pnpm dev` | ローカル開発 |
| `pnpm run deploy` | Web をビルドして Worker をデプロイ |

## 開発ルールの適用

指摘は変更行のバグ・権限漏れ・契約崩れを優先する。

| ルール | いつ読むか |
| --- | --- |
| `.cursor/rules/review.mdc` | 常時。プルリクエスト前の AI 相互レビュー |
| `.cursor/rules/architecture.mdc` | `apps/api/src/**/*.ts`。feature の置き場所、層、機能境界 |
| `.cursor/rules/testing.mdc` | `apps/api/src/**/*.test.ts` と `apps/api/vitest.config.ts`。単体テストの置き場所と骨抜き禁止 |
| `.cursor/rules/design.mdc` | `apps/web/**/*.{tsx,css}`。色・余白・角丸は `docs/design-system.md` と `apps/web/src/index.css` に合わせ、新規発明しない |
| `.cursor/rules/line-security.mdc` | `apps/api/src/{features,lib}/**/*.ts`。認証、LINE webhook、画像、ダイジェストの境界 |
| `.cursor/rules/logging.mdc` | `apps/api/src/**/*.ts`。JSON 1行。本文と秘密は出さない |
| `.cursor/rules/db.mdc` | `apps/api/migrations/**`、`apps/api/src/db/**`、`repository.ts`。マイグレーションは前進のみ |

作業時:

- API を触ったら該当 `*.test.ts` も更新する
- Web を触ったら、ブラウザが使えれば変更フローを確認する
- 契約を変えるときは `packages/shared` を先に直し、API と Web の parse を揃える
- API の feature は `index` / `service` / `repository` を跨いで DB や LINE I/O を直叩きしない

触らない:

- `apps/web/src/routeTree.gen.ts`（TanStack Router の生成物）
- lockfile と `apps/api/migrations/meta` の機械的差分
- `.dev.vars` など秘密情報
