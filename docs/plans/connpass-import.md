# プラン: connpass の参加イベントを予定に取り込む

状態: ドラフト（実装前に「着手前の確認」を済ませる）｜元資料: なし（チャットでの要件の合意）｜issue: #68

## 1. 概要

connpass API v2 で、ユーザーが参加登録したイベントを取り、Memotion の「予定」（`tag: schedule`）として自動で作る。1時間ごとの Cron と、設定画面の「今すぐ取り込む」ボタンで動かす。connpass 側で日時・名前が変わったら予定を合わせ、中止・参加取り消しになったら予定を消す。取り込んだ予定は、自分で登録した予定と同じく、カレンダーと前日の LINE 通知に出る。

## 2. 背景

勉強会やイベントの参加は connpass で管理していて、その日程を Memotion に手で写すのは手間で、写し忘れると前日の通知も来ない。予定（`docs/plans/schedule-calendar.md`）ができたので、connpass の参加イベントを予定として流し込めば、通知とカレンダーにそのまま載る。

## 3. 詳細設計

### connpass API v2 について（2026-10-26 時点で確認）

- すべてのエンドポイントで API キーが必須。`X-API-Key` ヘッダーで送る。認証に失敗すると 401
- 個人・コミュニティ向けは無償で、利用申請と審査があり、キーは1つだけ。ユーザーはキーを持っている
- 1キーにつき「1秒に1リクエストまで」。超えると 429
- API 以外の手段（スクレイピングなど）でのアクセスは利用規約で禁止
- OAuth は無い。本人のイベントは、ユーザー名（ニックネーム。`https://connpass.com/user/xxx/` の `xxx`）で絞って取る
- 使うエンドポイント:
  - `GET https://connpass.com/api/v2/events/?nickname=<名前>&ym=<yyyymm>,...&count=100&start=<n>` — 指定したユーザーが参加しているイベント。`ym` は複数指定できる。`count` は最大 100。応答は `results_returned`・`results_available`・`results_start`・`events`
  - `GET https://connpass.com/api/v2/users/?nickname=<名前>` — ユーザー名が存在するかの確認
- イベントの項目のうち使うもの: `id`（整数）、`title`、`started_at`（ISO-8601）、`open_status`（`preopen` / `open` / `close` / `cancelled`）。応答に「本人の参加状態（参加・補欠・キャンセル）」は無い
- 出典: [API リファレンス](https://connpass.com/about/api/v2/)、[API 利用について](https://help.connpass.com/api/)、[API 利用規約](https://help.connpass.com/api/api-term.html)

### 着手前の確認（実装の前に、人が実際のキーで行う）

AI のセッションは API キーを扱わない。人が手元の `curl` で次を確かめ、結果をこのプランに書き足してから実装に入る。結果しだいで「判断済みの論点」を直す。

1. `nickname` での検索に、補欠・抽選待ちの申し込みが含まれるか（含まれるなら、補欠のイベントも予定になる。それでよいかを決める）
2. connpass で参加を取り消したイベントが、`nickname` の検索結果から消えるか（消えない場合、「取り消したら予定を削除」は実現できない）
3. `started_at` の形（`+09:00` 付きか）と、`ym` を複数指定したときの結果
4. 存在しないユーザー名で `GET /api/v2/users/` を呼んだときの応答（`users` が空か、404 か）

### 合意済みの仕様

- API キーは Worker の secret（`CONNPASS_API_KEY`）に置く。DB・画面・ログには出さない
- connpass のユーザー名は、Web の設定画面で入力し、ユーザーごとに DB に保存する。空なら取り込まない
- 取り込みは1時間ごとに自動で動かす（今の毎分の Cron の中で、前回から1時間たったユーザーだけ）。設定画面に「今すぐ取り込む」ボタンも置く
- 開催日（JST）が今日以降のイベントだけを取り込む
- 予定の作り方: 今の「予定」のメモとして作る。日付と時刻は `started_at` を JST に直した値。本文はイベント名だけ（URL は保存しない）
- 二重登録は、connpass のイベント ID と作った予定の対応を別の表に残して防ぐ
- Memotion で取り込んだ予定を削除したら、そのイベントは以後取り込まない
- connpass 側で開催日時かイベント名が変わったら、次の取り込みで予定を connpass の値で上書きする。Memotion で手で変えた日時も、connpass 側が変わったときは上書きされる
- イベントが中止になったとき（`open_status` が `cancelled`）と、connpass で参加を取り消したとき（取得結果から消える）は、次の取り込みで予定を削除する
- 前日の LINE 通知には、自分で登録した予定と同じ形で載せる。通知のコードは変えない
- Web では、取り込んだ予定と自分で登録した予定を区別しない。`Memo` の契約も変えない

### 判断済みの論点（実装時に迷わないための決め）

取得:

- 取得する月: JST の今月から 12 か月先までの 13 か月を `ym` に並べて1回で取る（参加履歴が多いユーザーで、過去のページを全部めくらないため）。13 か月より先のイベントは取り込まない（スコープ外）。取得したあと、開催日（JST）が今日より前のものを捨てる
- ページ送り: `count=100`、`start` を 1, 101, 201... と進め、取得件数の合計が `results_available` に届いたら終わる。ページの間は 1 秒あける（1秒1リクエストの制限）。ページは最大 10 まで（1000 件）。届かないまま上限に達したら「途中で切れた」とする
- どれかのページで HTTP の失敗・429・タイムアウト・応答の形の不一致（Zod の失敗）があったら、取り込み全体を失敗にし、予定には何も反映しない
- ページの上限で途中で切れたときは、取れた分の作成と更新だけ行い、削除はしない。取得結果から消えたイベントの予定を削除するのは、取得が「最後まで取れた」ときだけ（一部しか取れていないときに、未来の予定をまとめて消さないため）
- connpass の応答は信用しない外部の入力として、`features/connpass/` に置く Zod で parse する（`packages/shared` には置かない。Memotion の公開契約ではないため）。`id` は正の整数、`title` は文字列、`started_at` は日時、`open_status` は4値のどれか。1件でも形が合わないページは、そのページ全体を失敗にする
- HTTP の呼び出しは、宛先を `https://connpass.com/api/v2/` に固定する。ユーザー名は `URLSearchParams` で渡す。タイムアウトは 10 秒（`AbortSignal.timeout`）。リダイレクトは追わない
- API キーが未設定（`CONNPASS_API_KEY` が空）のときは、取得せずに終わり、`skipped`（`reason: no_api_key`）をログに出す

予定への反映（純粋関数 `planConnpassSync` で決める）:

- 入力は、取得したイベント（今日以降に絞ったもの）、取得が最後まで取れたか、そのユーザーの対応表の行（下の `connpass_imports`。予定が残っているかを含む）、今日（JST）、取得した月の範囲
- イベントごとに:
  - 中止（`cancelled`）: 対応表に行があり予定が残っていれば、予定と対応表の行を削除する。行が無ければ何もしない
  - 対応表に行が無い: 予定を作り、対応表に行を足す。`title` を前後の空白で切って空なら作らない
  - 対応表に行があり、予定が削除済み（ユーザーが消した）: 何もしない
  - 対応表に行があり、予定が残っている: connpass の値（名前・日付・時刻）が、前回取り込んだ値と違えば、予定と対応表の行を更新する。同じなら何もしない（connpass の `updated_at` は概要の編集でも変わるので使わない。概要だけの変更で、手で変えた日時を上書きしないため）
- 取得結果から消えたイベント（取得が最後まで取れたときだけ）: 対応表の行で、予定が残っていて、前回取り込んだ日付が今日以降かつ取得した月の範囲内のものは、予定と対応表の行を削除する。前回取り込んだ日付が今日より前のもの（開催済み）は残す
- 処理が削除した予定は、対応表の行も消す。connpass で参加し直したら、もう一度取り込まれる。ユーザーが消した予定は、対応表の行が残る（予定への参照が NULL になる）ので、もう取り込まれない
- 開催日を過去に変えられたイベントは、取得結果から消えたものとして削除される（まれなので、そのままにする）
- 時刻: `started_at` を JST に直した `HH:MM`。日をまたぐイベントは開始日の予定にする。終了時刻は持たない（予定が終了時刻を持たないため）
- 本文のメモの種別は `text` に固定する（イベント名が URL の形でも、URL のメモとして OGP を取りにいかない）
- メモの `source` は `web` にする（`Memo` の契約を変えないという合意のため。取り込み元は対応表で分かる）。`createdAt` は取り込んだ時刻
- 予定の登録で過去の日付を弾く検査（`validateCreateSchedule`）は、取り込みでは使わない（取り込みの始めに決めた「今日」で絞ってから作るため）
- 今日の予定と、前日の通知の時刻を過ぎてから取り込んだ翌日の予定は、LINE に通知されない（今の予定と同じ扱い。前日の通知はもう済んでいるため）

同時実行と頻度:

- 取り込みの開始は、`connpass_settings.last_synced_at` を条件付きの1文で進めて「先取り」する。Cron は「`last_synced_at` が NULL か、1時間以上前」、手動は「60 秒以上前」のときだけ取れる。更新された行が 0 なら、別の実行が動いているか、間隔が足りないとして何もしない（手動のときは 429 `connpass_sync_too_soon`）。Cron と手動が重なっても、同じユーザーの取り込みは同時に走らない
- 失敗しても先取りは戻さない（次の時刻に再試行する。手動なら 60 秒後に押し直せる）。結果は `last_sync_status`（`success` / `failed`）に残し、設定画面に出す
- Cron は、取り込みの時刻が来たユーザーを1回の実行で順に処理し、ユーザーの間も 1 秒あける（キーは全ユーザーで1つのため）。1回の実行で処理するのは最大 5 人（毎分動くので、残りは次の分に回る）
- 予定の作成・更新・削除と、対応表の書き込みは、イベントごとに D1 の `batch` で1つにまとめる（片方だけ書かれた状態を作らない）。対応表の `(user_id, event_id)` の一意制約で、万一重なっても二重に作らない（一意制約の違反はそのイベントを飛ばすだけ）

設定:

- ユーザー名の形: `^[A-Za-z0-9_-]{1,50}$`（着手前の確認で、connpass の実際の規則と違えば直す）
- 保存するとき、`GET /api/v2/users/?nickname=` で存在を確かめる。見つからなければ 400（`connpass_user_not_found`）。打ち間違いのユーザー名で取り込み、結果が0件になって未来の予定をまとめて消すのを防ぐ。connpass に繋がらなければ 502（`connpass_unavailable`）で、保存しない
- ユーザー名を変えたら、次の取り込みで、前のユーザー名で取り込んだ未来の予定は「取得結果から消えた」として削除される（意図した仕様）。設定画面のヒントに書く
- ユーザー名を空にしたら、設定の行を消し、取り込みを止める。取り込み済みの予定と対応表は残す（あとで同じユーザー名を入れ直しても、消した予定は戻らない）
- ユーザー名を保存しただけでは取り込まない。保存のあと、最初の取り込みは次の Cron（1分以内。`last_synced_at` が NULL のため）で動く

### 機能境界

- 新しい機能 `features/connpass/` を作る。`connpass_settings` と `connpass_imports` の表と、connpass API の呼び出しを持つ
- `memos` の表は `memos` の機能が持つ。connpass の機能は、`memos` の service が返す「文」（作成・更新・削除。`deleteInGroupStatement` と同じ形）を受け取り、自分の対応表の文と一緒に `batch` で実行する。`memos` の repository を直接は呼ばない
  - `memos` の service に足すもの: `insertImportedScheduleStatement`、`updateImportedScheduleStatement`、`deleteImportedScheduleStatement`。どれも `memos.user_id` で絞り、更新と削除はタグが `schedule` でグループなしの行だけを対象にする
- 依存は `connpass` → `memos` の一方向。`notifications` は変えない（取り込んだ予定は、ふつうの予定として今の前日通知に載る）
- Cron の入口: 今は `notifications/scheduled.ts` の `scheduled` を `index.ts` が直接出している。新しく `apps/api/src/scheduled.ts` を作り、通知（今の `scheduled` の中身）と connpass の取り込みを、互いの失敗で止めないように順に呼ぶ。`index.ts` はそれを出す

### 認可

- 新しいルートは、どれも先頭で `readSessionUserId` を呼び、無ければ 401
  - `GET /api/connpass/settings` — 自分の設定だけを返す
  - `PUT /api/connpass/settings` — 自分の設定だけを書く。本文は `packages/shared` の Zod で検査（400）
  - `POST /api/connpass/sync` — 自分の取り込みだけを動かす
- 対応表と予定の読み書きは、すべて `user_id`（セッションのユーザー）で絞る。connpass のイベント ID は、ユーザーをまたいで共有しない（一意制約も `(user_id, event_id)`）
- `.agents/rules/line-security.md` に、上の3つのルートが `readSessionUserId` 必須であることと、connpass への呼び出しの宛先を固定することを足す

### 変更するファイル（見込み）

契約（先に直す）:

- `packages/shared/src/connpass.ts` — 新規
  - `connpassNicknameSchema`
  - `connpassSettingsSchema`（`nickname: string | null`、`lastSyncedAt: string | null`、`lastSyncStatus: "success" | "failed" | null`）
  - `updateConnpassSettingsRequestSchema`（`nickname: connpassNicknameSchema | null`）
  - `connpassSyncResponseSchema`（`created`、`updated`、`deleted` の件数と、`complete`（最後まで取れたか））
- `packages/shared/src/error.ts` — `apiErrorCodeSchema` に `connpass_user_not_found`、`connpass_not_configured`、`connpass_sync_too_soon`、`connpass_unavailable` を足す
- `packages/shared/src/index.ts` — 書き出す

API（`connpass`。新規）:

| ルート | 内容 |
| --- | --- |
| `GET /api/connpass/settings` | 自分の設定を返す。行が無ければ `nickname: null` |
| `PUT /api/connpass/settings` | ユーザー名を保存する（存在の確認つき）か、`null` で消す |
| `POST /api/connpass/sync` | 今すぐ取り込む。ユーザー名が無ければ 409（`connpass_not_configured`）、60 秒以内なら 429（`connpass_sync_too_soon`）、connpass に繋がらなければ 502（`connpass_unavailable`）。成功したら件数を返す |

- `apps/api/src/features/connpass/index.ts` — 上の3つのルート（401、本文の検査、service の結果の対応表だけ）
- `apps/api/src/features/connpass/service.ts` — 設定の読み書き、ユーザー名の存在確認、1ユーザーの取り込み（先取り → 取得 → `planConnpassSync` → `batch` で反映 → 結果の記録）
- `apps/api/src/features/connpass/client.ts` — connpass API の呼び出し（イベントのページ送り、ユーザーの存在確認）。応答の Zod もここに置く。結果は `success`（イベントと `complete`）か `failed`（`status` つき）で返し、例外を外に出さない
- `apps/api/src/features/connpass/plan.ts` — 純粋関数。`planConnpassSync`（判断済みの論点の「予定への反映」）
- `apps/api/src/features/connpass/event-schedule.ts` — 純粋関数。`started_at` → JST の日付と時刻、今月から 12 か月先までの `ym` の並び、今日以降かの判定
- `apps/api/src/features/connpass/repository.ts` — 設定の読み書き、先取りの1文、取り込みの時刻が来たユーザーの一覧、対応表の読み取りと、対応表の作成・更新・削除の文
- `apps/api/src/features/connpass/scheduled.ts` — Cron から呼ぶ `runConnpassSync(env, now)`
- `apps/api/src/features/memos/service.ts`・`repository.ts` — 取り込み用の3つの文（機能境界を参照）
- `apps/api/src/scheduled.ts` — 新規。Cron の入口（機能境界を参照）
- `apps/api/src/index.ts` — `connpassRoutes` を足し、`scheduled` を新しい入口に差し替える
- `apps/api/src/env.ts` — `CONNPASS_API_KEY` を足す
- `apps/api/.dev.vars.example` — `CONNPASS_API_KEY=` を足す（値は書かない）

DB:

- `apps/api/src/db/schema.ts`
  - `connpass_settings` を足す（`id`、`user_id`（`users.id` を参照、`onDelete: restrict`、一意）、`nickname`（text、NOT NULL）、`last_synced_at`（text、NULL 可）、`last_sync_status`（text、NULL 可））
  - `connpass_imports` を足す（`id`、`user_id`（`users.id` を参照、`onDelete: restrict`）、`event_id`（integer、NOT NULL）、`memo_id`（`memos.id` を参照、NULL 可、`onDelete: set null`）、`imported_title`、`imported_date`、`imported_time`（NULL 可）、`created_at`。`(user_id, event_id)` を一意にする）
  - `memo_id` だけ `set null` にするのは、ユーザーがメモを消したことを、削除の経路（`POST /api/memos/bulk-delete`）を変えずに対応表へ残すため。NULL の行が「ユーザーが消したので、もう取り込まない」を表す
- マイグレーション（前進のみ。`.agents/rules/db.md`）: `pnpm --filter @repo/api db:generate` で生成し、`CREATE TABLE` 2つと索引だけで、`memos` を作り直していないことを確かめる。ローカルの D1 で、メモを消すと `connpass_imports.memo_id` が NULL になること（外部キーが効いていること）を確かめる
- `.agents/rules/db.md` — 「設定」の節に `connpass_settings` と、`connpass_imports.memo_id` の NULL の意味を足す

Web:

- `apps/web/src/features/connpass/api/` — 新規。`get-connpass-settings.ts`、`update-connpass-settings.ts`、`sync-connpass.ts`（`apiFetch` と `packages/shared` の Zod で parse）
- `apps/web/src/features/connpass/components/connpass-settings.tsx` — 新規。設定画面の「connpass 連携」の節
  - ユーザー名の入力と保存。見つからないときは欄の下にエラーを出す
  - 「今すぐ取り込む」ボタン。結果は「N件追加・N件更新・N件削除」のトーストで出す。途中で切れたときは「一部だけ取り込みました」と添える。429 のときは「少し待ってからもう一度お試しください」
  - 最後に取り込んだ時刻と結果（成功・失敗）
  - ヒント: 1時間ごとに自動で取り込むこと、今日以降のイベントだけであること、ユーザー名を変えると前のユーザー名の予定は消えること、Memotion で消した予定は戻らないこと
  - オフラインでは保存と取り込みを押せない
- `apps/web/src/routes/_app/settings.tsx` か `features/notifications/components/settings-view.tsx` — 上の節を、今の通知の設定の下に置く
- 取り直すキー: 取り込みが成功したら `["memos"]` と `["connpass"]` を取り直す（カレンダーとメモタブに出す）

### デプロイの順序と互換

- マージの前に、人が `wrangler secret put CONNPASS_API_KEY` で本番にキーを置き、`pnpm --filter @repo/api db:migrate:remote` を実行する（AI のセッションでは実行しない）
- キーが無いまま出しても、取り込みが `no_api_key` で止まるだけで、ほかの機能は壊れない。マイグレーションをしないまま出すと、Cron の取り込みと設定画面の connpass の節が失敗する（ほかの Cron は、入口で独立に動くので止まらない）
- 増えるのは新しいテーブルと新しいルートだけで、`memos` の列と `Memo` の契約は変えない。旧版の API に戻しても、取り込んだ予定はふつうの予定として読める

### ログ（`.agents/rules/logging.md`）

| event | status / action | キー | いつ |
| --- | --- | --- | --- |
| `connpass.sync` | `success` / `failed` / `skipped`（`reason: no_api_key` か `too_soon`）/ `tick` | `userId`, `trigger`（`cron` / `manual`）, `created`, `updated`, `deleted`, `complete`, `pages`, `httpStatus`（失敗のとき） | 1ユーザーの取り込みごと。`tick` には、処理した人数と失敗の人数を出す |

- API キー、ユーザー名、イベント名、日付はログに出さない。connpass の応答本文も出さない
- D1 の例外は投げ直さず、`userId` と件数だけをログに出す（例外の message に本文が入るため。予定の機能と同じ）

## 4. テスト影響範囲

- `memos` のテスト: 取り込み用の3つの文を足すだけで、既存の関数は変えない。既存のケースは壊れない
- `notifications` のテスト: Cron の入口を `apps/api/src/scheduled.ts` に移すが、`runTechWeeklyDigest` などの中身は変えない。既存のケースは壊れない
- `packages/shared` の `apiErrorCodeSchema` に値が増えるが、既存のケースは壊れない

## 5. 新規テストケース

単体（Vitest。対象ファイルの隣の `*.test.ts`）:

- `event-schedule.test.ts`
  - `started_at` が `2026-11-03T19:00:00+09:00` → `2026-11-03` と `19:00`
  - UTC の表記（`2026-11-02T15:30:00Z`）→ JST の `2026-11-03` と `00:30`（日付の境目）
  - 今月から 12 か月先までの `ym`: 2026-10 → `202610` から `202710` の 13 個。12 月をまたぐ（2026-12 → `202612` から `202712`）
  - 今日以降の判定: 今日は含む、昨日は含まない
- `plan.test.ts`（`planConnpassSync`）
  - 対応表に無いイベント → 作成
  - 名前が空白だけのイベント → 作らない
  - 対応表にあり、予定が残り、値が同じ → 何もしない
  - 名前だけ変わった / 日付だけ / 時刻だけ変わった → 更新
  - 対応表にあり、予定が削除済み（`memo_id` が NULL）→ 何もしない（値が変わっていても）
  - 中止で、予定が残っている → 削除。中止で、対応表に無い → 何もしない
  - 取得結果から消えた、最後まで取れた、前回の日付が今日以降で範囲内 → 削除
  - 同じで、取得が途中で切れた → 削除しない（作成と更新は行う）
  - 取得結果から消えた、前回の日付が昨日（開催済み）→ 残す
  - 取得結果から消えた、予定が削除済み → 何もしない
- `client.test.ts`（`fetch` を差し替える。`vi.mock` で対象を差し替えない）
  - URL が `https://connpass.com/api/v2/events/` で、`nickname`・`ym`・`count=100`・`start` が付き、`X-API-Key` ヘッダーが付く
  - ユーザー名に `&` などが入っても、クエリが壊れない（`URLSearchParams`）
  - 2ページ（`results_available` が 150）→ `start=1` と `start=101` を呼び、`complete: true`
  - ページの上限に達した → `complete: false`
  - 2ページ目が 500 / 429 / タイムアウト → `failed`（1ページ目のイベントも返さない。予定には何も反映しない）
  - 応答の形が違う（`id` が文字列、`open_status` が未知の値）→ `failed`
  - キーが空 → `fetch` を呼ばない
  - ユーザーの存在確認: `users` が1件 → 存在、0件 → 不在
- `index.test.ts`（ルート）
  - 3つのルートとも、セッションなしで 401
  - `PUT /api/connpass/settings` に不正なユーザー名（空文字、51 文字、`/` を含む）→ 400
- `packages/shared` の Zod（`connpassNicknameSchema`）: 境界の 1 文字と 50 文字は通り、0 文字と 51 文字は通らない
- 先取りの判断を純粋関数にするなら（`isSyncDue(lastSyncedAt, now, interval)`）: ちょうど1時間前は取れる、59 分 59 秒前は取れない、NULL は取れる

ブラウザでの確認（ローカル。connpass の実際の API はキーが要るので、着手前の確認のあとに人が行う）:

- 設定画面でユーザー名を保存 → 1分以内に取り込まれ、カレンダーとメモタブに予定が出る
- 存在しないユーザー名 → 欄の下にエラーが出て、保存されない
- 「今すぐ取り込む」を続けて2回押す → 2回目は「少し待って」のトーストが出る
- 取り込んだ予定を削除 → 「今すぐ取り込む」（60 秒後）で戻ってこない
- 翌日のイベントを取り込む → 前日の通知の時刻に、ほかの予定と同じ形で LINE に届く
- スマホ幅（375px）で connpass の節がはみ出さない

## 6. 実装順

0. 着手前の確認（人が実際のキーで行い、結果をこのプランに書き足す）
1. 契約（`packages/shared/src/connpass.ts`、`error.ts`）
2. DB（スキーマ、マイグレーションの生成と確認、ローカルで `set null` が効くことの確認）
3. 純粋関数: `event-schedule.ts`、`plan.ts`。失敗するテスト → 最小の実装
4. `client.ts`（`fetch` を差し替えたテスト → 実装）
5. `memos` の service の3つの文、`connpass` の repository と service、ルート
6. Cron の入口（`apps/api/src/scheduled.ts`）と `runConnpassSync`
7. Web の設定画面の節
8. ブラウザで5章を確かめる
9. 実装完了後、別セッションの AI レビュー（`.agents/rules/review.md`）。P0・P1 を直す

## 7. コミット前テスト実行

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @repo/api test`
- `pnpm build`

## 8. スコープ外

- 13 か月より先のイベントの取り込み
- 過去の参加イベントの取り込み（参加履歴としてのカレンダー）
- イベントの URL・会場・終了時刻を予定に持たせること
- Web と LINE 通知で、取り込んだ予定を区別して見せること（`Memo` の契約を変えない）
- 補欠・抽選待ちを、参加確定と分けて扱うこと（API が本人の参加状態を返さないため。着手前の確認の結果しだいで見直す）
- 発表するイベント（`presenter_events`）や、管理しているイベントの取り込み
- connpass 以外のイベントサービス（Doorkeeper など）
- 取り込みの失敗を LINE で知らせること
- 前日の通知の時刻を過ぎてから取り込んだ翌日の予定を、当日に知らせること
