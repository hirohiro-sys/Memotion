# バックエンド環境

`apps/api` は Cloudflare Workers（Hono）です。メモの保存先は Notion のデータベースだけで、Worker は Notion API に書きます。重複判定の記録は KV、通知の送信済みの記録は Durable Object に置きます。本番は同じ Worker が `/` に Vite の dist、`/api/*` に API を出します。公開 API は次のとおりです。health、認証の入口、LINE Webhook（署名検証）以外は、セッションが必須です。

| 領域 | パス |
|------|------|
| health | `GET /api/health` |
| 認証 | `GET /api/auth/line`、`GET /api/auth/line/callback`、`POST /api/auth/logout`、`GET /api/me`、`GET /api/auth/dev`（ループバックの http だけ。それ以外は 404） |
| LINE | `POST /api/line/webhook`（署名検証） |
| メモ | `POST /api/memos`（作成だけ。一覧、変更、削除は Notion で行う） |

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
| KV | `line-memo-orchestrator-dedup` |

設定の正は [`apps/api/wrangler.toml`](../apps/api/wrangler.toml) です。KV の `id` は秘密情報ではないので git に含めてよいです。`.dev.vars` と `.wrangler/` はコミットしないでください。

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
| `LINE_CHANNEL_ACCESS_TOKEN` | Reply、Push（週次・日次・予定の前日） |
| `SESSION_SECRET` | JWT 署名。十分長いランダム値 |
| `APP_URL` | ログイン後の戻り先。ローカルは `http://127.0.0.1:5173`。本番は `https://line-memo-orchestrator.hirohiro-sys.workers.dev` |
| `ALLOWED_LINE_USER_IDS` | Web のログインと LINE からの保存を許す LINE ユーザーID。カンマ区切り。無ければ誰も許さない |
| `APP_USER_ID` | 許可した人のセッションに入れるアプリのユーザーID。許可した全員がこの 1 人になる。無ければ誰も許さない。本番は D1 のころの `users` の `id` の値のまま（発行済みのセッション、端末の未送信のメモ、KV の記録がこの値を持つ）。変えると、それらが別の人のものとして扱われる |
| `NOTION_TOKEN` | Notion のインテグレーションのトークン。無ければメモを保存できず、通知も送らない |
| `NOTION_DATA_SOURCE_ID` | メモを書く Notion のデータソースの ID。無ければメモを保存できず、通知も送らない |
| `NOTIFY_LINE_USER_ID` | LINE 通知の送り先の LINE ユーザーID（1人）。任意。無ければ通知しない |
| `NOTION_VIEW_URL` | 通知の「他N件」から開く Notion のページの URL。任意。無ければ `APP_URL` |

本番は同じ名前を `wrangler secret` で入れる。開発用バイパス用の変数は作らない。Messaging 用と Login 用を取り違えると、署名がすべて 400 になり何も残らない。

```bash
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_ID
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_SECRET
pnpm --filter @repo/api exec wrangler secret put LINE_MESSAGING_CHANNEL_SECRET
pnpm --filter @repo/api exec wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
pnpm --filter @repo/api exec wrangler secret put SESSION_SECRET
pnpm --filter @repo/api exec wrangler secret put APP_URL
pnpm --filter @repo/api exec wrangler secret put ALLOWED_LINE_USER_IDS
pnpm --filter @repo/api exec wrangler secret put APP_USER_ID
pnpm --filter @repo/api exec wrangler secret put NOTION_TOKEN
pnpm --filter @repo/api exec wrangler secret put NOTION_DATA_SOURCE_ID
pnpm --filter @repo/api exec wrangler secret put NOTIFY_LINE_USER_ID
pnpm --filter @repo/api exec wrangler secret put NOTION_VIEW_URL
```

通知の時刻（`TECH_WEEKLY`、`TODO_DAILY`、`SCHEDULE_DAILY`）は秘密ではないので、`wrangler.toml` の `[vars]` に置きます。「通知」の節を見てください。

## 日常の開発

```bash
pnpm install
pnpm dev
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

`vite.config.ts` は `/api` を `:8787` にプロキシします。メモの API は Worker に届きます。

ローカルでもメモは Notion に書きます。`.dev.vars` の `NOTION_TOKEN` と `NOTION_DATA_SOURCE_ID` には、本番とは別の開発用のデータベースを入れます（作り方は「Notion」の節）。空のままだと、Web のメモは保存できず、端末の未送信に残ります。KV と Durable Object はローカルのものを使います。`wrangler.toml` に `remote = true` を付けると本番に繋がるので付けません。

API だけ起動する場合:

```bash
pnpm --filter @repo/api run dev
```

ローカル health:

```bash
curl http://127.0.0.1:8787/api/health
# {"status":"ok"}
```

## Notion

メモの保存先は Notion のデータベースだけです（#143 で D1 を外しました）。Web のメモは応答の前に、LINE のメモは webhook に 200 を返したあとに、Notion にページを作ります。

- 書けなかったら、Web は 502 を返します。端末は未送信に残し、あとで同じ ID で送り直します。LINE は「保存できませんでした」と返信します。どちらも `memo.notion`（`status: failed`、`httpStatus`）のログを残します
- `NOTION_TOKEN` か `NOTION_DATA_SOURCE_ID` が無いときは書かず、保存の失敗として扱います（`status: skipped`、`reason: no_secret`）
- Notion は 503 を返しても保存していることがあります。書き込みがネットワークの失敗か 5xx のときは、「メモID」で検索して、あれば保存できたとして扱います。作ったばかりのページが検索にまだ出ないと、LINE には「保存できませんでした」と返しつつページはできていることがあり、送り直すと 2 ページになります
- LINE の画像は保存せず、「この形式は保存できません」と返信します（#136）
- 作成だけを書きます。種類の付け直し、予定の変更、削除は Notion で行います

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

LINE の再送と Web のオフライン再送で同じメモを二重に保存しないよう、受け取った記録を Cloudflare KV（バインディング `DEDUP`）に置きます（#137）。

| 記録 | キー | 値 | 保持 |
|------|------|----|------|
| LINE の受信済み | `line-message:<LINE のメッセージ ID>` | 保存したメモの ID | 7 日 |
| Web の保存済み | `web-memo:<端末が付けたメモ ID>` | 保存したメモと持ち主のユーザー ID | 30 日 |

- 保存の前に KV を見て、記録があれば重複として扱います。LINE は何もしません。Web は、持ち主と内容が同じなら 200 で保存済みのメモを返し、違えば 409 を返します
- 記録が無いときは Notion に書き、書けたら KV に記録します
- Web のメモは、記録が無くても、書く前に Notion を「メモID」で検索し、ページがあれば作らずに 200 を返します。KV の書き込みの失敗や 30 日の期限切れのあとの再送を止めるためです。この経路では持ち主と内容を比べません（許可した全員が 1 人で、ID は端末が付ける UUID v4 のため）。検索そのものが失敗したときは、そのまま作ります。LINE のメモは Worker が ID を付けるので検索しません
- KV はほぼ同時に届いた 2 件を止めきれません。Web の同じメモがほぼ同時に 2 回届くと、Notion に 2 ページできることがあります
- KV の読み書きに失敗しても保存は止めません。`memo.dedup`（`status: failed`、`reason: read` か `write`）のログを残して先へ進みます
- Web の記録は保存した時点の写しで、Notion で種類や予定を変えたり、ページを消したりしても更新しません。記録がある間の再送は 200 になり、消したページは復活しません。Web は 200 の本文を使わず「保存しました」と出すだけなので、古い内容は画面に出ません
- Web の記録には本文が入るので、メモを消しても KV に最大 30 日残ります
- ローカルの `wrangler dev` は、`id` があってもローカルの KV を使います。`remote = true` を付けると本番の KV に繋がるので付けません

### 本番の名前空間を作る（初回のみ、手作業）

`wrangler.toml` に `id` が無いままデプロイすると、wrangler が名前空間を自動で作ります。CI のデプロイで意図せず作られないよう、`#137` をマージする前に手元で作り、`id` を書いてコミットします。

```bash
pnpm --filter @repo/api exec wrangler kv namespace create line-memo-orchestrator-dedup
```

出力の `id` を、`apps/api/wrangler.toml` の `[[kv_namespaces]]`（`binding = "DEDUP"`）に `id = "..."` として足します。

## LINE Messaging

Login チャネルと**同じプロバイダー**の下に Messaging API チャネルを置く。別プロバイダーだと `userId` が変わり、`ALLOWED_LINE_USER_IDS` と一致しない。実体が同じチャネルなら、同じ値を Login 用と Messaging 用の変数に入れてよい。名前は必ず分ける。

1. Basic settings の Channel secret → `LINE_MESSAGING_CHANNEL_SECRET`
2. Messaging API タブの長期 Channel access token → `LINE_CHANNEL_ACCESS_TOKEN`
3. 応答メッセージ・あいさつメッセージをオフにする。オンのままだと成功時も LINE が返信する
4. グループ・複数人トークへの参加をコンソールで止める
5. Webhook URL を `https://line-memo-orchestrator.hirohiro-sys.workers.dev/api/line/webhook` にする（本番オリジンが別ならそちら）
6. Use webhook をオンにする。Verify が 200 になること
7. Webhook redelivery をオンにする（200 を返せなかったとき用）

パスは `POST /api/line/webhook`。

許可ユーザーは環境変数 `ALLOWED_LINE_USER_IDS` に足す（#142）。友だち追加だけでは Web にも入れず、LINE から送ったメモも保存しない。許可した全員は `APP_USER_ID` の 1 人として扱う。

開発用ログインはこの 2 つを使わず、固定のユーザー ID `usr_dev_local` でセッションを出す。

## LINE Login

コンソールの Callback URL に次を**両方**置く。片方だけだと、ローカルか本番のログインが落ちる。

- ローカル: `http://127.0.0.1:8787/api/auth/line/callback`
- 本番: `https://line-memo-orchestrator.hirohiro-sys.workers.dev/api/auth/line/callback`

成功後の画面は `APP_URL`。本番の `APP_URL` が `5173` のままだと、Callback のあとローカルへ戻る。Webhook URL は触らない。

## 通知

LINE 通知は 3 つです（#140）。メモは Notion のデータベースから読み、設定は環境変数、送信済みの記録は Durable Object（バインディング `NOTIFY_STATE`、クラス `NotifySentState`、インスタンスは名前 `notify` の 1 つ）に置きます。KV は書いた値がほかの拠点で読めるまで 60 秒ほどかかり、送った次の分の cron が古い記録を読んで同じ通知を送り直しうるので使いません。Durable Object はデプロイで自動的に作られ（`wrangler.toml` の `[[migrations]]`）、手作業の準備はありません。Web の設定画面と `/api/notifications` はありません。

| 通知 | 設定（`[vars]`） | 読むメモ | 記録のキー |
|------|------------------|----------|-----------|
| tech の週次（`tech.weekly`） | `TECH_WEEKLY = "sun 20:00"` | 種類が `tech` で、記録日時が直近の通知時刻までの 1 週間のもの | `tech-weekly:last-sent-at` |
| todo の日次（`todo.daily`） | `TODO_DAILY = "08:00"` | 種類が `todo` のものすべて | `todo-daily:last-sent-at` |
| 予定の前日（`schedule.daily`） | `SCHEDULE_DAILY = "20:00"` | 種類が `schedule` で、予定日時の JST の日付が翌日のもの | `schedule-daily:last-target-date` |

- 時刻は JST です。`TECH_WEEKLY` の曜日は `sun` / `mon` / `tue` / `wed` / `thu` / `fri` / `sat` です。空にするとその通知はオフです。形が違うとオフとして扱い、毎分 `reason: invalid` のログを出します。変えたらデプロイします
- 送り先は `NOTIFY_LINE_USER_ID` の 1 人です。Notion のメモには持ち主の情報が無いからです
- todo を終えたら、Notion でページを消すか、種類を変えます。予定の日時の変更も Notion で行います
- #138 より前のメモは Notion に移していないので（#139 で移さないと決めた）、通知に入りません
- 記録が無いとき（初回）は送らず、今を送信済みとして記録します（`reason: baseline`）。切り替えた直後のデプロイで同じ回を送り直さないためです。最初の通知は次の時刻に届きます
- Notion を読むのは送る時刻が来たときだけで、1 回の通知で最大 5 ページ（500 件）です。Notion の日付の絞り込みは広めにかけ、正確な範囲（JST の日付、1 週間の窓）はコードで絞ります
- 送信済みとして記録するのは、送れたとき、LINE に届かなかったとき（ブロックなど）、メモが 0 件のとき、送り先か Notion の秘密が無いとき、Notion が 400・401・403・404 を返したとき（トークンや ID の誤りで、送り直しても直らない）です。Notion の一時的な失敗（ネットワーク、429、5xx）と LINE の一時的な失敗は記録せず、次の分に送り直します。予定の前日通知は、Notion を読む前に対象日を処理済みにし（先取り）、記録しない失敗のときは元に戻します
- 5 ページ（500 件）で打ち切ったときは、ログに `truncated: true` を付けます。見出しの件数は読めた分だけです
- 時刻を後ろにずらしてデプロイすると、その日の分がもう一度届くことがあります（例: 08:00 に送ったあとで 09:00 に変える）

Cron は [`apps/api/wrangler.toml`](../apps/api/wrangler.toml) の `* * * * *`（毎分、UTC）です。壁時計は `Asia/Tokyo` です。発火はデプロイ済み Worker だけです。ローカルの `wrangler dev` には頼らないでください。

毎分の入口は `apps/api/src/features/notifications/scheduled.ts` です。3 つの通知を、互いの失敗で止めないように順に動かします。送る時刻の判定は、設定と記録と現在時刻だけで決めます。

Push は既存の `LINE_CHANNEL_ACCESS_TOKEN` を使います。Login チャネルの秘密では送れません。溢れたときは「他N件はこちら」のあとに `NOTION_VIEW_URL`（無ければ `APP_URL`）を付けます。

## リモート（初回のみ）

リソースは作成済みです。別アカウントでやり直すとき用です。

```bash
pnpm --filter @repo/api exec wrangler login
pnpm --filter @repo/api exec wrangler whoami
```

```bash
pnpm --filter @repo/api exec wrangler kv namespace create line-memo-orchestrator-dedup
```

出力の `id` を `apps/api/wrangler.toml` の `[[kv_namespaces]]` に書く。

```bash
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

## CI/CD

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) が PR と `main` への push で lint、typecheck、API テスト、web build を走らせます。`main` への push だけ、check のあと `pnpm run deploy` します。

GitHub Secrets（Actions）に入れるのは次だけです。LINE 系・`SESSION_SECRET`・`APP_URL` は今どおり Cloudflare の `wrangler secret` です。取り違えると、デプロイは通ってもログインが切れます。

| 名前 | 用途 |
|------|------|
| `CLOUDFLARE_API_TOKEN` | ダッシュボードの API Tokens で発行。テンプレート「Edit Cloudflare Workers」。手元の wrangler OAuth は使わない |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami` の Account ID |

Token に D1 や R2 の編集は付けない。CI は使わないので、漏れたときの被害を広げるだけです。

## 再デプロイ

```bash
pnpm run deploy
```

## D1 と R2 の片づけ（#143、一度だけ）

#143 で D1（`line-memo-orchestrator`）、R2（`line-memo-orchestrator-media`）、Workers AI を Worker から外しました。データベースとバケットは Cloudflare に残っているので、#143 のデプロイが終わってから手で消します。先に消すと、その時点で動いている Worker が壊れます。消す前に、本番の D1 は手元に SQL で書き出してあります（メモ 18 件。Notion には移していません）。

1. 本番の Web にログインでき、Web と LINE から送ったメモが Notion に入ることを確かめる
2. D1 を消す。元に戻せない

   ```bash
   pnpm --filter @repo/api exec wrangler d1 delete line-memo-orchestrator
   ```

3. R2 のバケットを消す。中身（URL のメモの OGP 画像。2026-11-24 の時点で 2 個）が残っていると消せないので、ダッシュボードの R2 で中身を消してから消す

   ```bash
   pnpm --filter @repo/api exec wrangler r2 bucket delete line-memo-orchestrator-media
   ```
