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
│   │       ├── features/    # auth / connpass / daily-reports / groups / line / memos / notifications
│   │       ├── lib/         # session, JST, LINE I/O
│   │       └── db/
│   └── web/
│       └── src/
│           ├── routes/
│           ├── features/    # auth / connpass / daily-reports / groups / memos / notifications / pwa / schedule
│           ├── components/
│           └── config/
├── packages/shared/         # API 契約の Zod
├── docs/
├── .agents/                 # ハーネスの実体。rules/ skills/ agents/
├── .claude/                 # Claude Code 用。.agents への symlink と settings.json
└── .cursor/                 # Cursor 用。rules/ は .agents への symlink
```

## 主要コマンド（テスト、ビルド、リント）

`apps/` か `packages/` を変えたら、緑になるまで次を回す。ハーネスや docs だけの変更では回さない。コミットのしかたは「pstack」の節に従う。

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
| `pnpm build` | Web のビルド（`tsc -b && vite build`）。API に build は無く、型は `pnpm typecheck` |
| `pnpm dev` | ローカル開発 |
| `pnpm run deploy` | Web をビルドして Worker をデプロイ |

## pstack

作業は pstack（Cursor 公式の `cursor/plugins`）の `/pstack:poteto-mode` から始める。導入は Claude Code のユーザー全体で、このリポジトリには置かない。

```bash
claude plugin marketplace add cursor/plugins
claude plugin install pstack@cursor-plugins
```

導入後に Claude Code を再起動し、`/pstack:setup-pstack` で推論の予算とモデルを決める。設定は `~/.claude/rules/pstack-models.md` に書かれる。ロール行を `AGENTS.md` に書かない。

このプロジェクトでは、次の順で優先する。

1. 制約は pstack より優先する。`line-security.md`、`logging.md`、`db.md`、「触らない」、秘密情報の扱い、本番を変更するコマンドを実行しないこと。
2. 進め方は pstack に合わせる。以下の「開発ルールの適用」と食い違うときは pstack を正とし、食い違いを報告して、この節か該当ルールを直す。
3. コミットは、検証が通った論理的なまとまりごとに、指示を待たずに切ってよい。push、プルリクエストの作成、マージは、指示があるときだけ行う。
4. Cursor 専用の機能（Bugbot、Automations、Cloud Agents）は使わない。PR は `gh pr create` を使う。

## 開発ルールの適用

ルール・スキル・エージェントの実体は `.agents/` にある。`.claude/` と `.cursor/` はそこへの symlink で、直すのは `.agents/` だけ。ルールの frontmatter は Cursor 用（`description` / `globs` / `alwaysApply`）と Claude Code 用（`paths`）を併記している。

指摘は変更行のバグ・権限漏れ・契約崩れを優先する。

| ルール | いつ読むか |
| --- | --- |
| `.agents/rules/review.md` | 常時。プルリクエスト前の AI 相互レビュー |
| `.agents/rules/architecture.md` | `apps/api/src/**/*.ts`。feature の置き場所、層、機能境界 |
| `.agents/rules/testing.md` | `apps/api/src/**/*.test.ts` と `apps/api/vitest.config.ts`。単体テストの置き場所と骨抜き禁止 |
| `.agents/skills/impeccable` | `apps/web` の見た目を変えるとき。`/impeccable` で呼ぶ。文脈は `apps/web/PRODUCT.md` と `apps/web/DESIGN.md`、値の正本は `apps/web/src/index.css` |
| `.agents/skills/verify-memotion` | Web の変更を動かして確かめるとき。`scripts/launch.sh` で起動し、`features/` の手順でブラウザを操作して証拠を残す。pstack の検証はこれを使う |
| `.agents/rules/line-security.md` | `apps/api/src/{features,lib}/**/*.ts` と `apps/web/src/**/*.{ts,tsx}`。認証、LINE webhook、画像、ダイジェスト、Web の API 呼び出しの境界 |
| `.agents/rules/logging.md` | `apps/api/src/**/*.ts`。JSON 1行。本文と秘密は出さない |
| `.agents/rules/db.md` | `apps/api/migrations/**`、`apps/api/src/db/**`、`repository.ts`。マイグレーションは前進のみ |

作業時:

- API を触ったら該当 `*.test.ts` も更新する
- Web を触ったら、ブラウザが使えれば変更フローを確認する
- 契約を変えるときは `packages/shared` を先に直し、API と Web の parse を揃える
- API の feature は `index` / `service` / `repository` を跨いで DB や LINE I/O を直叩きしない

触らない:

- `apps/web/src/routeTree.gen.ts`（TanStack Router の生成物）
- lockfile と `apps/api/migrations/meta` の機械的差分
- `.dev.vars` など秘密情報

## Cursor Cloud specific instructions

- Node は 24.21.0（`package.json` の engines は `>=24.14.0`）。`/exec-daemon/node` は 22 で PATH の前方にあるので、解決される `node` は `/usr/local/cargo/bin/node`（実体は `/usr/local/bin/node`）。pnpm は corepack の 10.34.5。
- pnpm 10 は依存のビルドスクリプトを止める。`pnpm-workspace.yaml` の `allowBuilds` で esbuild、workerd、msw を許可する。無いと Vite と Wrangler が起動しない。
- `apps/api/wrangler.toml` の D1 と R2 はローカル。そこに `remote = true` を付けると本番に繋がる。Cloud Agent では付けない。AI バインディングだけはローカルにモデルが無いので `remote = true` で、推論先は Workers AI。D1 には書かない。`wrangler dev --local` は AI の remote まで切るので、日報の生成を試すときは付けない。`apps/web/dist` は gitignore なので、Wrangler の前にスタブを作る。API と Web は別プロセスで同時に起動する。

```bash
pnpm --filter @repo/api exec node ./scripts/ensure-dev-assets.mjs && pnpm --filter @repo/api exec wrangler dev --ip 127.0.0.1 --port 8787
```

```bash
pnpm --filter @repo/web dev -- --host 127.0.0.1 --port 5173
```
- 起動前に `apps/api/.dev.vars.example` を `apps/api/.dev.vars` にコピーし、`SESSION_SECRET` を空にしない。ローカルマイグレーションは `pnpm --filter @repo/api db:migrate:local`。
- Web は `http://127.0.0.1:5173`、API は `http://127.0.0.1:8787`。Vite が `/api` を 8787 にプロキシする。
- `db:migrate:remote` と `pnpm run deploy` は本番を変更する。Cloud Agent では実行しない。
