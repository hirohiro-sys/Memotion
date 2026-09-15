# バックエンド環境

`apps/api` は Cloudflare Workers（Hono + Drizzle + D1 + R2）です。公開 API は health、LINE Login、`POST /api/line/webhook`、ログイン必須のメモ閲覧、`GET` / `PATCH /api/notifications` です。開発時に MSW は使いません。`/api` は Worker に届きます。

## 前提

- Node.js 24 以上
- pnpm 10 以上
- Cloudflare アカウント
- リポジトリルートで作業する

```bash
cd /path/to/line-memo-orchestrator
pnpm install
```

## リソース名

| 種類 | 名前 |
|------|------|
| Worker | `line-memo-orchestrator` |
| D1 | `line-memo-orchestrator` |
| R2 | `line-memo-orchestrator-media` |

設定の正は [`apps/api/wrangler.toml`](../apps/api/wrangler.toml) です。`database_id` は秘密情報ではないので git に含めてよいです。`.dev.vars` と `.wrangler/` はコミットしないでください。

## 環境変数

ローカルは [`apps/api/.dev.vars.example`](../apps/api/.dev.vars.example) をコピーして [`apps/api/.dev.vars`](../apps/api/.dev.vars) を作り、値を入れる。

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

| 変数 | 用途 |
|------|------|
| `LINE_CHANNEL_ID` | 認可 URL と IDトークン検証の audience |
| `LINE_CHANNEL_SECRET` | 認可コードの交換。ブラウザに出さない |
| `LINE_MESSAGING_CHANNEL_SECRET` | Webhook 署名。Login の `LINE_CHANNEL_SECRET` と混ぜない |
| `LINE_CHANNEL_ACCESS_TOKEN` | Reply、画像取得、週次の Push |
| `SESSION_SECRET` | JWT 署名。十分長いランダム値 |
| `APP_URL` | ログイン後の戻り先。ローカルは `http://127.0.0.1:5173` |

本番は同じ名前を `wrangler secret` で入れる。開発用バイパス用の変数は作らない。Messaging 用と Login 用を取り違えると、署名がすべて 400 になり何も残らない。

```bash
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_ID
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_SECRET
pnpm --filter @repo/api exec wrangler secret put LINE_MESSAGING_CHANNEL_SECRET
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
pnpm --filter @repo/api exec wrangler secret put SESSION_SECRET
pnpm --filter @repo/api exec wrangler secret put APP_URL
```

## 日常の開発

```bash
pnpm install
pnpm --filter @repo/api db:migrate:local
pnpm dev
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

`vite.config.ts` は `/api` を `:8787` にプロキシします。メモも通知設定も Worker に届きます。

LINE で残した行をローカル Web で見るには、[`apps/api/wrangler.toml`](../apps/api/wrangler.toml) の `DB` と `MEDIA` に `remote = true` を付ける。`pnpm dev` のコマンドはそのまま（Vite → `:8787`）。秘密は `.dev.vars`（`APP_URL=http://127.0.0.1:5173`）。Cookie は今と同じ `127.0.0.1`。許可ユーザーはリモート D1 に入っていること。

```toml
[[d1_databases]]
binding = "DB"
database_name = "line-memo-orchestrator"
database_id = "…"
migrations_dir = "migrations"
remote = true

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "line-memo-orchestrator-media"
remote = true
```

`remote = true` のとき、persist 付きのローカル Webhook curl は本番に行を付ける。署名だけ見るか、隔離するなら `wrangler dev --local`。

API だけ起動する場合:

```bash
pnpm --filter @repo/api run dev
```

ローカル health:

```bash
curl http://127.0.0.1:8787/api/health
# {"status":"ok"}
```

## DB コマンド

| コマンド | 用途 |
|----------|------|
| `pnpm --filter @repo/api db:generate` | Drizzle スキーマからマイグレーション SQL を生成 |
| `pnpm --filter @repo/api db:migrate:local` | ローカル D1 に適用 |
| `pnpm --filter @repo/api db:migrate:remote` | リモート D1 に適用 |

スキーマの正は [Issue #3](https://github.com/hirohiro-sys/line-memo-orchestrator/issues/3) と [`apps/api/src/db/schema.ts`](../apps/api/src/db/schema.ts) です。初回マイグレーションで `tags` に `tweet` / `tech` / `other` を入れています。

ローカルの tags 確認:

```bash
pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --local --command "SELECT slug FROM tags"
```

スキーマを変えたら `db:generate` → 生成 SQL を確認 → `db:migrate:local`。問題なければ `db:migrate:remote`。

## LINE Messaging

Login チャネルと**同じプロバイダー**の下に Messaging API チャネルを置く。別プロバイダーだと `userId` が変わり、`users.line_user_id` と一致しない。実体が同じチャネルなら、同じ値を Login 用と Messaging 用の変数に入れてよい。名前は必ず分ける。

1. Basic settings の Channel secret → `LINE_MESSAGING_CHANNEL_SECRET`
2. Messaging API タブの長期 Channel access token → `LINE_CHANNEL_ACCESS_TOKEN`
3. 応答メッセージ・あいさつメッセージをオフにする。オンのままだと成功時も LINE が返信する
4. グループ・複数人トークへの参加をコンソールで止める
5. Webhook URL を `https://line-memo-orchestrator.hirohiro-sys.workers.dev/api/line/webhook` にする（本番オリジンが別ならそちら）
6. Use webhook をオンにする。Verify が 200 になること
7. Webhook redelivery をオンにする（200 を返せなかったとき用）

パスは `POST /api/line/webhook`。

許可ユーザーの追加は従来どおり、D1 の `users` への INSERT。友だち追加だけでは Web に入れない。Bot は `users` を自動作成しない。

## 通知

`GET` / `PATCH /api/notifications` はセッション必須です。件数（次の通に入る `#tech`）と自動オフ理由はサーバが返します。MSW で傍受しません。

Cron は [`apps/api/wrangler.toml`](../apps/api/wrangler.toml) の `* * * * *`（毎分、UTC）です。壁時計は `Asia/Tokyo` です。発火はデプロイ済み Worker だけです。ローカルの `wrangler dev` には頼らないでください。

Push は既存の `LINE_CHANNEL_ACCESS_TOKEN` を使います。Login チャネルの秘密では送れません。溢れ時の逃げ場は `APP_URL` のトップです。

## リモート（初回のみ）

リソースは作成済みです。別アカウントでやり直すとき用です。

```bash
pnpm --filter @repo/api exec wrangler login
pnpm --filter @repo/api exec wrangler whoami
```

```bash
pnpm --filter @repo/api exec wrangler d1 create line-memo-orchestrator
```

出力の `database_id` を `apps/api/wrangler.toml` に書く。

```bash
pnpm --filter @repo/api exec wrangler r2 bucket create line-memo-orchestrator-media
```

`Please enable R2`（code 10042）なら、ダッシュボードの Storage & databases → R2 で初回有効化して再実行する。

```bash
pnpm --filter @repo/api db:migrate:remote
pnpm --filter @repo/api run deploy
```

`pnpm --filter @repo/api deploy` は使わないでください。pnpm 本体の `deploy` が走ります。必ず `run deploy` です。

初回デプロイでは `workers.dev` サブドメイン登録を聞かれます。`Y` で、アカウント用の短い名前（例: `hirohiro-sys`）を付けます。Worker 名とは別です。

本番 health:

```
https://line-memo-orchestrator.hirohiro-sys.workers.dev/api/health
```

macOS 付属の `curl` で SSL handshake failure になることがあります。ブラウザで確認してください。

```bash
pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --remote --command "SELECT id, slug, name FROM tags ORDER BY slug"
```

## 再デプロイ

```bash
pnpm --filter @repo/api run deploy
```
