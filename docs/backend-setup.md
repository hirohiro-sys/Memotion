# バックエンド環境

`apps/api` は Cloudflare Workers（Hono + Drizzle + D1 + R2）です。本番は同じ Worker が `/` に Vite の dist、`/api/*` に API を出します。公開 API は次のとおりです。health、認証の入口、LINE Webhook（署名検証）以外は、セッションが必須です。

| 領域 | パス |
|------|------|
| health | `GET /api/health` |
| 認証 | `GET /api/auth/line`、`GET /api/auth/line/callback`、`POST /api/auth/logout`、`GET /api/me`、`GET /api/auth/dev`（ループバックの http だけ。それ以外は 404） |
| LINE | `POST /api/line/webhook`（署名検証） |
| メモ | `/api/memos`（一覧・作成）、`/api/memos/:id`（更新）、`/api/memos/:id/schedule`、`/api/memos/:id/image`、`/api/memos/bulk-delete` |
| グループ | `/api/groups`、`/api/groups/:id`、`/api/groups/:id/memos`、`/api/groups/:id/memos/assign` |
| 日報 | `/api/daily-reports`、`/api/daily-reports/:id`、`/api/daily-reports/:id/append` |
| 通知 | `GET` / `PATCH /api/notifications` |

正本は各 feature の `index.ts` と `packages/shared` の Zod です。開発時に MSW は使いません。ローカルの `/api` は Vite 経由で Worker に届きます。

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
| KV | `line-memo-orchestrator-dedup` |

設定の正は [`apps/api/wrangler.toml`](../apps/api/wrangler.toml) です。`database_id` と KV の `id` は秘密情報ではないので git に含めてよいです。`.dev.vars` と `.wrangler/` はコミットしないでください。

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
| `LINE_CHANNEL_ACCESS_TOKEN` | Reply、画像取得、Push（週次・日次・予定の前日） |
| `SESSION_SECRET` | JWT 署名。十分長いランダム値 |
| `APP_URL` | ログイン後の戻り先。ローカルは `http://127.0.0.1:5173`。本番は `https://line-memo-orchestrator.hirohiro-sys.workers.dev` |
| `NOTION_TOKEN` | Notion のインテグレーションのトークン。任意。無ければ Notion に書かない |
| `NOTION_DATA_SOURCE_ID` | メモを書く Notion のデータソースの ID。任意。無ければ Notion に書かない |

本番は同じ名前を `wrangler secret` で入れる。開発用バイパス用の変数は作らない。Messaging 用と Login 用を取り違えると、署名がすべて 400 になり何も残らない。

```bash
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_ID
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_SECRET
pnpm --filter @repo/api exec wrangler secret put LINE_MESSAGING_CHANNEL_SECRET
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
pnpm --filter @repo/api exec wrangler secret put SESSION_SECRET
pnpm --filter @repo/api exec wrangler secret put APP_URL
pnpm --filter @repo/api exec wrangler secret put NOTION_TOKEN
pnpm --filter @repo/api exec wrangler secret put NOTION_DATA_SOURCE_ID
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

## Workers AI

日報の生成は Workers AI を使います。[`apps/api/wrangler.toml`](../apps/api/wrangler.toml) の `[ai]`（バインディング `AI`、`remote = true`）で繋ぎ、キーは置きません。モデル ID は `features/daily-reports/client.ts` に固定しています。ローカルにモデルは無いので、`wrangler dev` でも推論は Cloudflare に届きます。`remote = true` が効くのは推論先だけで、D1 と R2 はローカルのままです。`wrangler dev --local` は AI の remote まで切るので、日報の生成を試すときは付けません。

## Notion

メモは D1 に保存したあと、Notion のデータベースにも書きます（#138）。正本はまだ D1 です。Notion への書き込みは応答のあとに行い、失敗しても `memo.notion`（`status: failed`、`httpStatus`）のログを残すだけで、Web と LINE には成功を返します。`NOTION_TOKEN` か `NOTION_DATA_SOURCE_ID` が無いときは書かず、`status: skipped`、`reason: no_secret` を残します。画像のメモは書きません。作成だけを書き、タグの付け直し、予定の変更、削除は Notion に反映しません。

準備は手作業です。

1. Notion で、次のプロパティを持つデータベースを作る。名前は1文字でも違うと 400 になる

   | プロパティ | 型 |
   | --- | --- |
   | 本文 | タイトル |
   | 種類 | 選択（英語の UI では Select。マルチセレクトとステータスではない。`tweet` / `tech` / `other` / `todo` / `schedule`） |
   | 予定日時 | 日付 |
   | 記録日時 | 日付 |
   | URL | URL |
   | 入力元 | 選択（`line` / `web`） |
   | メモID | テキスト |

2. [Notion のインテグレーション](https://app.notion.com/developers/connections)で内部インテグレーションを作り、機能は「コンテンツを読み取る」「コンテンツを挿入」をオンにする。シークレットを `NOTION_TOKEN` にする
3. データベースのページ右上の「…」→「詳細」→「接続」を開き、「接続先を探す」にインテグレーションの名前を入れて追加する。追加しないと 404 になる。ビューの設定の「コネクト」は外部サービス用で、ここではない
4. データベースの URL の `notion.so/` のあとの32文字がデータベース ID。データソース ID は次で取り、`data_sources[0].id` を `NOTION_DATA_SOURCE_ID` にする

   ```bash
   curl -s https://api.notion.com/v1/databases/<データベースID> -H "Authorization: Bearer $NOTION_TOKEN" -H "Notion-Version: 2025-09-03"
   ```

5. ローカルは `apps/api/.dev.vars`、本番は `wrangler secret put` で2つを入れる

## 重複判定（KV）

LINE の再送と Web のオフライン再送で同じメモを二重に保存しないよう、受け取った記録を Cloudflare KV（バインディング `DEDUP`）に置きます（#137）。D1 を外したあとも重複を防ぐためです。

| 記録 | キー | 値 | 保持 |
|------|------|----|------|
| LINE の受信済み | `line-message:<LINE のメッセージ ID>` | 保存したメモの ID | 7 日 |
| Web の保存済み | `web-memo:<端末が付けたメモ ID>` | 保存したメモと持ち主のユーザー ID | 30 日 |

- 保存の前に KV を見て、記録があれば重複として扱います。LINE は何もしません。Web は、持ち主と内容が同じなら 200 で保存済みのメモを返し、違えば 409 を返します
- 記録が無いときは D1 に保存し、保存できたら KV に書きます。KV はほぼ同時に届いた 2 件を止めきれないので、D1 の一意制約（`memos.id`、`memos.line_message_id`）を #143 まで保険として残します。導入前のメモの再送も D1 が止めます
- KV の読み書きに失敗しても保存は止めません。`memo.dedup`（`status: failed`、`reason: read` か `write`）のログを残して D1 の判定に進みます
- Web の記録は保存した時点の写しで、タグの付け直し、予定の変更、グループへの追加、削除では更新しません。そのため、記録がある間の再送は、メモを変えたあとでも 200 になり、消したメモは復活しません（以前は D1 の今の行と比べたので、変えたあとは 409、消したあとは保存し直していました）。Web は 200 の本文を使わずに一覧を取り直すので、古い内容は画面に出ません
- Web の記録には本文が入るので、メモを消しても KV に最大 30 日残ります
- ローカルの `wrangler dev` は、`id` があってもローカルの KV を使います。`remote = true` を付けると本番の KV に繋がるので付けません

### 本番の名前空間を作る（初回のみ、手作業）

`wrangler.toml` に `id` が無いままデプロイすると、wrangler が名前空間を自動で作ります。CI のデプロイで意図せず作られないよう、`#137` をマージする前に手元で作り、`id` を書いてコミットします。

```bash
pnpm --filter @repo/api exec wrangler kv namespace create line-memo-orchestrator-dedup
```

出力の `id` を、`apps/api/wrangler.toml` の `[[kv_namespaces]]`（`binding = "DEDUP"`）に `id = "..."` として足します。

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

## LINE Login

コンソールの Callback URL に次を**両方**置く。片方だけだと、ローカルか本番のログインが落ちる。

- ローカル: `http://127.0.0.1:8787/api/auth/line/callback`
- 本番: `https://line-memo-orchestrator.hirohiro-sys.workers.dev/api/auth/line/callback`

成功後の画面は `APP_URL`。本番の `APP_URL` が `5173` のままだと、Callback のあとローカルへ戻る。Webhook URL は触らない。

## 通知

`GET` / `PATCH /api/notifications` はセッション必須です。件数（次の通に入る `#tech`）と自動オフ理由はサーバが返します。MSW で傍受しません。

Cron は [`apps/api/wrangler.toml`](../apps/api/wrangler.toml) の `* * * * *`（毎分、UTC）です。壁時計は `Asia/Tokyo` です。発火はデプロイ済み Worker だけです。ローカルの `wrangler dev` には頼らないでください。

毎分の入口は `apps/api/src/features/notifications/scheduled.ts` です。技術メモの週次ダイジェスト（`tech.weekly`）、TODO の日次（`todo.daily`）、予定の前日（`schedule.daily`）を、互いの失敗で止めないように順に動かします。送る時刻の判定は、設定の行と現在時刻だけで決めます。

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
pnpm --filter @repo/api exec wrangler kv namespace create line-memo-orchestrator-dedup
```

出力の `id` を `apps/api/wrangler.toml` の `[[kv_namespaces]]` に書く。

```bash
pnpm --filter @repo/api db:migrate:remote
pnpm run deploy
```

`pnpm deploy` と `pnpm --filter @repo/api deploy` は使わないでください。pnpm 本体の `deploy` が走ります。手元の再デプロイもルートの `pnpm run deploy` です（先に web を build する）。`pnpm --filter @repo/api run deploy` だけだと、古い dist か空のスタブが載ります。

初回デプロイでは `workers.dev` サブドメイン登録を聞かれます。`Y` で、アカウント用の短い名前（例: `hirohiro-sys`）を付けます。Worker 名とは別です。

本番 health:

```
https://line-memo-orchestrator.hirohiro-sys.workers.dev/api/health
```

本番 Web は同じオリジンの `/` です。Pages には分けません。別ホストだと `sid` Cookie が付きません。

macOS 付属の `curl` で SSL handshake failure になることがあります。ブラウザで確認してください。

```bash
pnpm --filter @repo/api exec wrangler d1 execute line-memo-orchestrator --remote --command "SELECT id, slug, name FROM tags ORDER BY slug"
```

## CI/CD

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) が PR と `main` への push で lint、typecheck、API テスト、web build を走らせます。`main` への push だけ、check のあと `pnpm run deploy` します。D1 マイグレーションは CI では走りません。スキーマを変えたら、デプロイより先に手元で `db:migrate:remote` します。

GitHub Secrets（Actions）に入れるのは次だけです。LINE 系・`SESSION_SECRET`・`APP_URL` は今どおり Cloudflare の `wrangler secret` です。取り違えると、デプロイは通ってもログインが切れます。

| 名前 | 用途 |
|------|------|
| `CLOUDFLARE_API_TOKEN` | ダッシュボードの API Tokens で発行。テンプレート「Edit Cloudflare Workers」。手元の wrangler OAuth は使わない |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami` の Account ID |

Token に D1 編集は付けない。CI は migrate しない。漏れたときの被害を広げるだけです。デプロイが D1 権限不足で落ちてから足します。

## 再デプロイ

```bash
pnpm run deploy
```
