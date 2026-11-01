# プラン: 日報

状態: セルフレビュー済み（3回）。生成先は Workers AI｜元資料: [docs/design-docs/daily-reports.md](../design-docs/daily-reports.md)｜issue: [#31](https://github.com/hirohiro-sys/Memotion/issues/31)

## 1. 概要

メモ一覧で選んだメモから、生成AIが日報の本文を書き、同じ日付・同じ種類（仕事 / 個人）で1本だけ保存する。専用ページで一覧と編集をし、下書きのまま残すか、書き終わりの印（確定）を付けられる。確定したあとも本文は直せる。元のメモを消しても、日報の本文は残る。

## 2. 背景

メモは LINE と Web に残るが、その日の仕事や個人の記録として読み返す文章にはなっていない（issue #31）。日報は貯める文章である。月報と職務経歴書は、その文章をあとから読む側で、今回は作らない。

issue #31 の本文には、使わないあいだ feature トグルで隠す案がある。Design Doc は「表示のオンオフ」を非目標にしている。このプランはトグルを作らない。

## 3. 詳細設計

### 着手前の確認（決定済み）

生成先は Workers AI。モデルは `@cf/google/gemma-4-26b-a4b-it`。ここから変えない。

- secret は置かない。呼び出しは Worker の AI バインディング `AI`（`wrangler.toml` の `[ai] binding = "AI"`）。API キーを DB、画面、ログ、リポジトリ、`.dev.vars` に足さない。バインディングが無いときは回数を増やさず 502（`no_secret`）
- 宛先はバインディングとモデル ID に固定する。HTTP のオリジンは使わない。`stream` は false。リダイレクトは追わない。ユーザー入力は `messages` の本文だけに置き、URL に繋がない
- 応答は信用しない。本文は `choices[0].message.content` が空でない文字列ならそれ、なければ `response` が空でない文字列ならそれ。`reasoning` は本文にしない。どちらも取れなければ空。取り出した文字列は実行しない。空と長さの検査は、取り出したあとの純粋関数が行う
- モデルが書くのは本文だけである。先頭行はサーバーが付ける
- タイムアウトは 90 秒。このモデルは短い材料でも 1 分前後かかることがある。超えた応答は捨て、回数を1戻して 502（`upstream`）

### 合意済みの仕様

Design Doc の第3章を、実装が迷わない粒度にしたもの。判断を変えていない。

入口と画面:

- 入口はメモ一覧の選択バーである。チェックが1件以上あるときだけ「日報を追加」を出す。オフラインのときは押せない。削除と「グループに追加」の動作は変えない
- 押すとモーダルで、選んだメモ、日付、種類、フレームワークを確認してから作る
- 一覧は `/daily-reports`、編集は `/daily-reports/$id`。サイドバーは、メモ一覧、カレンダー、日報、設定の順
- カレンダーのマスには日報の印を付けない。選んだ日の枠には、その `report_date` の日報を「この日の日報」として、仕事と個人を横に並べ、状態だけ出す。無い種類は空
- オフラインの保存キューは作らない。日報の追加、足す、保存、削除は、オフラインのとき押せない

1本の単位:

- 同じユーザー、同じ `report_date`、同じ種類で1本。既にあるときは2本目を作らず、その日報を開く
- 開いた時点では本文もフレームワークも変えない。今回選んだメモのうち、まだ材料でないものだけを「まだ入っていない」と出す
- この一覧は遷移先の画面状態にだけ持つ。URL にもローカルストレージにも書かない。再読み込みすると消える。もう一度メモ一覧から同じ日報を開けば、対応が無いメモだけが再度出る

生成:

- 数えるのは新規作成、足す。既存を開く操作と、失敗して回数を戻したものは数えない
- 回数は、日報の日付ではなく、呼び出しを行った日（JST）の2回まで。`count` は、成功した呼び出しと、まだ終わっていない呼び出しの数
- キーが無いときは回数を増やさず 502（`daily_report_unavailable`）。生成先の失敗と空の応答は回数を1戻して 502。2万字超は回数を1戻して 400（`daily_report_too_long`）。どちらも日報は作らない（足すでは、本文と対応とフレームワークを変えない）
- 回数の増減と日報の書き込みは別の文である。増やしたあとに Worker が落ちると、その日の回数が1残ったまま戻らない。利用者はログインを許可された人だけなので、許容する
- 材料にできるのは、自分のメモのうち、グループに入っていないもの。タグでは除外しない。生成に渡すのは、本文、作成日時（JST）、URL があるときの URL。予定のメモには予定日と時刻も渡す。画像と画像 URL と画像キーは渡さない
- 先頭行（`10月29日（木） 仕事`。日付、曜日、種類。年は付けない）は `report_date` からサーバーが付ける。新規作成だけ。足すときは付けない。Worker の時刻には依らない
- モデルは材料を要約する。メモを1件ずつ写さず、同じ話題はまとめ、材料に無いことは書かない。記録（`log`）は時刻ごとの短い箇条書き。実績（`achievement`）は「やったこと」「気づき」「次にやること」
- 一度生成したあとの本文は手で直す。全文の作り直しはしない
- フレームワークを保存だけで変えても、本文は変えない。次に足す分から、そのとき選んだ型を使う

保存と削除:

- 新規作成の状態は下書き。確定は編集画面の保存だけが付ける
- 確定した日報を一時保存すると、印は下書きに戻る。本文はロックしない
- 日報を削除してもメモは消さない。生成回数は戻さない
- メモを削除すると、対応の行だけ消え、日報の本文は残る。同じメモを仕事と個人の両方から参照してよい

### 判断済みの論点（実装時に迷わないための決め）

日付と先頭行:

- 日付の契約は `scheduleDateSchema` を使う（`YYYY-MM-DD`、実在する日）。過去も未来も受け付ける。予定の「過去日は 400」は使わない
- モーダルの初期値は、種類が仕事、フレームワークが実績。種類を変えて、フレームワークをまだ手で変えていなければ、仕事は実績、個人は記録に戻す。手で変えたあとは、種類を変えてもフレームワークを自動で変えない
- 日付の初期値は、選んだメモの作成日（JST）が全部同じならその日、そうでなければ今日（JST）。作成日は `apps/web/src/features/schedule/jst.ts` の `jstDateOf`。今日は同じファイルの `jstToday`
- 先頭行は純粋関数 `headingLine(reportDate, kind)`。暦日は `YYYY-MM-DD` を UTC の日付として曜日を出す（端末や Worker のタイムゾーンで日付をずらさない）。月日はゼロ埋めしない。Web の `formatScheduleDate` と同じ「M月D日（曜）」に、半角空白と種類を足す。API は Web を import しない。種類は `work` が「仕事」、`personal` が「個人」。例: `2026-10-29` と `work` で `10月29日（木） 仕事`
- 2万字は、先頭行を含めた保存する本文の `String.length`（UTF-16 の符号単位）。見た目の文字数（書記素）では数えない

本文の連結と空:

- 純粋関数 `joinBody(current, addition)` は、現在の本文の末尾の改行と、追加文の先頭の改行だけを除いてから、間に空行1つ（`\n\n`）を挟んで繋ぐ。空白そのものと、中間の空行は削らない
- モデルの応答は `trim` して空なら空の応答（502、回数を1戻す）。先頭行だけでは成功にしない
- 保存（`PUT`）の本文は `trim` して1文字以上、2万字まで。空白だけと2万字超は契約の 400 で、専用の code は付けない（`daily_report_too_long` は生成結果だけ）

材料:

- メモ ID は1件以上90件まで。同じ ID が2つあれば契約の 400。90は、D1 の1クエリのバインド変数が100までで、`user_id` と ID の列を1文で取るため。対応の挿入は1行に3つの値をバインドするので、33行ずつに分け、同じ `db.batch` に入れる。`memos` の削除の契約上限（500、90件ずつ）は変えない
- 読み取りは `memos` の service に足す `findOwnedByIds`。`daily-reports` は `memos` の repository を呼ばない。`GET /api/memos` はグループのメモを返さない
- 返った行の数が、要求した ID の数と違えば `not_found`（他人のメモと無いメモは区別しない）。数が一致して、1件でも `groupId` があれば `ineligible`。数が違うときは、グループの行が混ざっていても `not_found` を先にする（404。グループに入っていることは返さない）。この判定は純粋関数 `decideMemoUse`。新規作成と足すだけが使い、`ineligible` は 400（`daily_report_memo_ineligible`）
- 足すは、上の検査のあとで、既に材料の ID を除く。残が0件なら 400。回数は動かさない。既に材料でも、グループへ移したメモを要求に含めると、除く前の検査で全体が 400 になる。画面は「まだ入っていない」ID だけを送る
- モデルへ渡す順は、作成日時の古い順。同じ時刻は `id` の昇順
- 作成日時は JST の `YYYY-MM-DD HH:MM`。予定（タグ `schedule`）だけ、予定日と、時刻が無ければ「時間未定」を渡す。プロンプトを組み立てる関数の引数に、画像キーと画像 URL を置かない
- 作成日時を JST に直せない行があるときは、生成せず回数を1戻して 502（`daily_report_unavailable`）

回数:

- 増やすのは1文。`used_on` は呼び出しの JST の日付（`memos/schedule.ts` の `jstDateOf(now)`。日報の `report_date` ではない）
- 行が無ければ `count = 1` で作る。あれば `count < 2` のときだけ1増やす。SQLite の `INSERT ... ON CONFLICT(user_id, used_on) DO UPDATE SET count = count + 1 WHERE count < 2`。`meta.changes` が 0 なら 429（`daily_report_ai_limit`）。WHERE が偽のときは制約違反にせず、挿入も更新もしない
- 戻すのも別の1文。`count > 0` のときだけ1減らす
- 一覧の残り回数は、今日の行が無ければ2、あれば `max(0, 2 - count)`。詳細の GET と編集画面には残しを足さない。尽きたあとの生成は 429 を画面に出す

競合:

- 新規作成は、回数を増やす前に同じユーザー・日付・種類を読む。あれば生成せず 409（`daily_report_exists`）で、その ID を返す
- そのあとで一意制約に敗れたとき（同時の作成）は、日報の行と対応の行を残さない。回数を1戻し、もう一度読んで ID を 409 で返す。読めなければ 404（`daily_report_not_found`）
- 日報の挿入と対応の挿入は、`db.batch` の1つにまとめる。保存と足すの本文と対応とフレームワークの更新も同じ
- 一意制約の判定は、drizzle が包んだ `Failed query:` の message（SQL と本文が入りうる）を見ない。cause を辿る。判定の関数は `memos` の外部キー判定をコピーせず、日報のファイルに置く
- 生成のあとの書き込みに失敗したときは、本文を残さず（足すでは変えない）、回数を1戻して 502
- 足すの更新は、読んだ `updated_at` が一致する行だけを書く。一致しなければ、足した対応を消し、回数を1戻して 502。本文は変えない。保存（`PUT`）が0行なら 404

状態と削除:

- `PUT` が書くのは本文、状態、フレームワークだけ。生成しない
- 削除は日報の行を消す。対応は `report_id` の `onDelete: cascade`。メモの削除は `memo_id` の `onDelete: cascade` で対応だけが消える
- 削除の応答は `{ "deleted": true }` の 200。回数の行は消さない

画面状態:

- 409 でも作成成功でも、選んだメモ ID を `navigate` の `state`（`pendingMemoIds`）にだけ載せて詳細へ行く。search には載せない
- 詳細は、取得した材料 ID に無い `pendingMemoIds` だけを「まだ入っていない」に出す
- 生成中の「作成」と「足す」は、ボタンの中にスピナーを出す。確定すると `/daily-reports` へ戻る。一時保存は編集画面に残る

### 機能境界

- 新しい機能 `features/daily-reports/`。日報、材料の対応、生成回数、生成の呼び出しを持つ
- 依存は `daily-reports` → `memos` の一方向。`memos` に足すのは `findOwnedByIds` だけ。カレンダーは日報の一覧を同じキーで読む。`notifications` と `connpass` の取得は変えない
- `index.ts` はルート定義と、401、契約の 400、service の結果を status に写すだけ。業務判断とクエリは書かない
- 先頭行、連結、空と長さ、材料の採用、プロンプトの文字列は純粋関数。DB、`fetch`、時刻、secret は service と repository と `client.ts`

### 認可

すべてのルートは先頭で `readSessionUserId`。無ければ 401。

| ルート | 成功 | 失敗 |
| --- | --- | --- |
| `GET /api/daily-reports` | 200。自分の一覧（本文なし）と、今日の残り回数 | |
| `GET /api/daily-reports/:id` | 200。本文と材料のメモ ID | 他人と無い日報は 404（`daily_report_not_found`） |
| `POST /api/daily-reports` | 201。保存した日報 | 下の作成の順 |
| `POST /api/daily-reports/:id/append` | 200。更新した日報 | 日報が無ければ 404。メモは作成と同じ基準。残0件は 400 |
| `PUT /api/daily-reports/:id` | 200。保存した日報。確定のあと画面は一覧へ戻る | 日報が無ければ 404。本文が契約に反すれば 400 |
| `DELETE /api/daily-reports/:id` | 200。`{ "deleted": true }` | 日報が無ければ 404 |

作成の順（Design Doc のとおり）:

1. セッションが無ければ 401。入力が契約に反すれば 400
2. メモを `findOwnedByIds` で取る。他人と無いメモが1件でもあれば 404。自分のメモでもグループに入っていれば 400。日報は作らない
3. 同じユーザー・日付・種類があれば 409。回数は減らさない
4. secret が無ければ 502。あるときは回数を1文で増やす。増えなければ 429
5. 生成する。先頭行はサーバーが付ける
6. 空か失敗は回数を1戻して 502。2万字超は回数を1戻して 400。日報は作らない
7. 下書きとして日報と対応を `batch` で書く。一意制約に敗れたときは行を残さず、回数を1戻して 409

読み書きはセッションの `user_id` で絞る。日報、対応、回数のどれも。

足す、保存、削除の順は、401、契約の 400（`:id` が1〜64文字でなければここ）、その日報が自分のものでなければ 404、そのあと材料の検査。他人の日報に対して、メモがグループに入っていることの 400 は返さない。一覧の SQL は `report_date` の降順、同じ日は `work` を先にする。詳細の `memoIds` は、メモの作成日時の古い順（同じ時刻は `id` の昇順）で、プロンプトと同じ順にする。

### 契約（`packages/shared`。先に直す）

`packages/shared/src/daily-report.ts` を新規にし、`index.ts` から書き出す。`apiErrorCodeSchema` に次を足す。

- `daily_report_not_found`
- `daily_report_memo_ineligible`
- `daily_report_too_long`
- `daily_report_exists`
- `daily_report_ai_limit`
- `daily_report_unavailable`

409 の ID は、汎用の `apiErrorSchema` には足さない（他の呼び出しが未知の欄を落とすため）。日報のクライアントだけが、次で parse する。

- `dailyReportExistsErrorSchema`: `message`、`code: "daily_report_exists"`、`dailyReportId`（1文字以上64文字まで）

種類は `work` | `personal`。フレームワークは `log` | `achievement`。状態は `draft` | `confirmed`。本文は `trim` して1文字以上2万字まで。メモ ID は `memoIdSchema` の配列で、1件以上90件、重複なし。

- 一覧の1件: `id`、`reportDate`、`kind`、`framework`、`status`、`createdAt`、`updatedAt`。本文もメモ ID も無い
- 一覧の応答: `reports` と `remainingGenerations`（0以上2以下の整数）
- 1本の応答: 一覧の1件に、`body` と `memoIds` を足したもの。作成、足す、保存もこの形
- 作成の要求: `reportDate`、`kind`、`framework`、`memoIds`
- 足すの要求: `framework`、`memoIds`
- 保存の要求: `body`、`status`、`framework`
- 削除の応答: `{ deleted: true }`

### 変更するファイル（見込み）

API:

- `apps/api/src/features/daily-reports/index.ts` — 上の6ルート
- `apps/api/src/features/daily-reports/service.ts` — 作成、足す、保存、削除、一覧、1本。回数の増減と `batch` の順を持つ
- `apps/api/src/features/daily-reports/repository.ts` — 日報、対応、回数の読み書きと、増減の1文、`batch` に渡す文
- `apps/api/src/features/daily-reports/heading.ts` — `headingLine`
- `apps/api/src/features/daily-reports/body.ts` — `joinBody`、空、2万字
- `apps/api/src/features/daily-reports/eligibility.ts` — `decideMemoUse` だけ
- `apps/api/src/features/daily-reports/prompt.ts` — モデルへ渡す順と文字列。引数は本文、作成日時、URL、タグ、予定日、予定時刻、`id`。画像キーは置かない
- `apps/api/src/features/daily-reports/constraint-error.ts` — 一意制約の判定
- `apps/api/src/features/daily-reports/client.ts` — `env.AI.run` を呼ぶ。`fetch` は使わない。結果は `ok` か、`empty` / `upstream` / `no_secret`。例外を外に出さない
- `apps/api/src/features/memos/service.ts` — `findOwnedByIds` を足す
- `apps/api/src/features/memos/repository.ts` — その読み取り（`user_id` と ID の列。`group_id`、本文、URL、作成日時、タグ、予定日、予定時刻）。`group_id IS NULL` では絞らない。グループかどうかは `decideMemoUse` が見る
- `apps/api/src/index.ts` — `dailyReportRoutes` を足す
- `apps/api/src/env.ts` — `AI: Ai`。secret の文字列は足さない
- `apps/api/.dev.vars.example` — 同じ名前を空で足す

DB（`apps/api/src/db/schema.ts`。マイグレーションは前進のみ）:

- `daily_reports`: `id`、`user_id`（`users.id`、`onDelete: restrict`）、`report_date`、`kind`、`framework`、`body`、`status`、`created_at`、`updated_at`。`(user_id, report_date, kind)` を一意
- `daily_report_memos`: `id`（`crypto.randomUUID()`）、`report_id`（`onDelete: cascade`）、`memo_id`（`memos.id`、`onDelete: cascade`）。`(report_id, memo_id)` を一意。日報と回数の `id` も `crypto.randomUUID()`。日報の `updated_at` は、作成、足す、保存のたびに進める。`created_at` は作成時だけ
- `daily_report_ai_uses`: `id`、`user_id`（`onDelete: restrict`）、`used_on`、`count`。`(user_id, used_on)` を一意
- `memos` の列は変えない
- 生成は `pnpm --filter @repo/api db:generate`。`CREATE TABLE` 3つと一意制約だけで、`memos` を作り直していないことを SQL で確かめる。`migrations/meta` は手で直さない
- `.agents/rules/db.md` の「設定」に、3テーブルと、対応が cascade で消えること、回数の行は日報を消しても残ることを足す

Web:

- `apps/web/src/routes/_app/daily-reports/index.tsx` — 一覧。`routeTree.gen.ts` は生成物なので手で直さない
- `apps/web/src/routes/_app/daily-reports/$id.tsx` — 編集
- `apps/web/src/features/daily-reports/api/` — `apiFetch` と `packages/shared` の Zod。409 は `dailyReportExistsErrorSchema`
- `apps/web/src/features/daily-reports/components/daily-report-list.tsx` — 日付ごとに1行、新しい順。列は日付、仕事、個人。マスは状態（下書き / 確定）。無い種類は「—」。「今日の生成はあと N 回」。0件は「日報はまだありません」
- `apps/web/src/features/daily-reports/components/daily-report-editor.tsx` — 本文、フレームワーク、一時保存（`draft`）、確定（`confirmed`。一覧へ戻る）、削除。`pendingMemoIds` が残っていれば「まだ入っていない」と足す。生成中はスピナー
- `apps/web/src/features/daily-reports/components/create-daily-report-dialog.tsx` — モーダル。初期値の規則は上のとおり
- `apps/web/src/features/memos/components/memo-list.tsx` — 選択バーに「日報を追加」を足すだけ。削除とグループ追加の処理は変えない。オフラインのときは `title` で理由を示す（グループ追加と同じ）
- `apps/web/src/components/layout/sidebar.tsx` — `NAV_ITEMS` のカレンダーと設定の間に日報。アイコンは lucide の既存のもの（`NotebookPen`）。色のトークンは足さない
- `apps/web/src/features/schedule/components/day-report-list.tsx` — 選んだ日の「この日の日報」。仕事と個人を横に並べ、状態だけ出す。無い種類は「—」
- 取り直すキー: 作成・更新・削除・足すの成功で `["daily-reports"]`。メモ一覧は取り直さない（メモは変えない）

見た目は `docs/design-system.md` と `.agents/rules/design.md`。カードは `rounded-xl border border-border bg-card`。主ボタンは画面に1つ（モーダルでは作成、編集では確定）。足すは `secondary`。

### デプロイの順序と互換

- `pnpm --filter @repo/api db:migrate:remote` を行ってから Worker をデプロイする。AI のバインディングは `wrangler.toml` に書く。API キーは置かない。AI のセッションでは remote のマイグレーションとデプロイを実行しない
- バインディングが無いまま出しても、生成だけが 502 になる。一覧、保存、削除はできる
- マイグレーションの前に新しい Worker を出すと、日報のルートだけが失敗する。旧版の API は日報のテーブルを読まない
- 増えるのは新しいテーブルと新しいルートだけ。`Memo` の契約と `memos` の列は変えない

### ログ（`.agents/rules/logging.md`）

失敗のときだけ、各 feature の既存の `logJson` で1行出す。新しい helper は作らない。成功のたびに出さない。

| event | status | reason | キー | いつ |
| --- | --- | --- | --- | --- |
| `daily_report.generate` | `failed` | `limit` / `upstream` / `empty` / `too_long` / `no_secret` / `write` | `userId` | 生成を試した失敗。429 は `limit`。キーが無い 502 は `no_secret`。空は `empty`。2万字超は `too_long`。生成先の HTTP 失敗と、日時を直せない材料は `upstream`。保存の失敗は `write` |

- メモ本文、URL、生成した本文、プロンプト、API キー、secret の名前の値は出さない
- D1 の例外は投げ直してログの message にしない（`Failed query:` に本文が入りうる。`memos` の制約判定と同じ）
- 標準キーの event 一覧に `daily_report.generate` を足す
- `.agents/rules/line-security.md` に、上の7ルートが `readSessionUserId` 必須であること、回数と日報の読み書きを `user_id` で絞ること、生成先の宛先を固定し、応答を実行しないこと、キーは secret だけであることを足す
- Design Doc の reason は、このプランと揃えて6語にしてある。`no_secret` はキーが無い 502、`write` は保存の失敗で、どちらも `upstream` と区別する

## 4. テスト影響範囲

- `apiErrorCodeSchema` に code が増える。既存のケースは、知らない code を落とす挙動を変えない（列挙に足すだけ）
- `memos` の既存の関数は変えない。`findOwnedByIds` を足すだけなので、既存のケースは壊れない
- カレンダー、通知、connpass、グループのテストは変えない
- Web に単体テストは無い。画面の確認はブラウザで行う

## 5. 新規テストケース

単体（Vitest。対象ファイルの隣の `*.test.ts`。D1 は立てない）:

- `heading.test.ts`
  - `2026-10-29` と `work` → `10月29日（木） 仕事`
  - `2026-01-02` と `personal` → `1月2日（金） 個人`（ゼロ埋めしない。年を出さない）
  - `2024-02-29` と `work` → `2月29日（木） 仕事`
  - 実行環境のタイムゾーンを変えずに、日付文字列だけで曜日が決まること（`Date.now` を使わない）
- `body.test.ts`
  - `joinBody("本文", "追加")` → `本文\n\n追加`
  - 末尾と先頭の改行がいくつあっても、挟む空行は1つ。行の途中の空白は残る
  - 中間の空行は残る
  - モデルの本文を `trim` して空なら、連結する前に空と判定する。先頭行をその判定に足さない
  - 保存する本文は、先頭行を含めて 20000 字は通り、20001 字は拒む
- `eligibility.test.ts`
  - 要求した ID が全部返り、どれもグループでなければ `ok`
  - 1件足りなければ `not_found`。グループの行が混ざっていても `not_found`
  - 数が一致して、1件でもグループなら `ineligible`
- `prompt.test.ts`
  - 文字列に、本文、JST の作成日時、URL、予定の予定日と「時間未定」が出る
  - フィクスチャの URL は出る。フィクスチャに置いていない `image-key-sentinel` は出ない
  - 作成日時の古い順。同じ時刻は `id` の昇順
  - 記録は時刻ごとの箇条書き、実績は「やったこと」「気づき」「次にやること」。どちらも、先頭行をモデルに書かせない指示を含む
- `constraint-error.test.ts`
  - cause に `UNIQUE constraint failed: daily_reports` があれば真
  - 外側の message が `Failed query:` で UNIQUE と本文を含み、cause が別のエラーなら偽
- `index.test.ts`
  - 7ルートすべて、セッションなしは 401。本文が壊れた JSON でも、セッションが無ければ 401（400 より先）
  - セッションあり（`memos` のテストと同じ、`SESSION_SECRET` で署名した Cookie）で、作成、足す、保存の形の違う本文と、65文字の `:id` は 400。環境に D1 を渡さない。ここで DB に触るとテストは 400 にならず落ちる
  - 契約のスキーマ: メモ ID の重複、91件、`2026-02-30`、空白だけの本文、20001字は失敗する。`dailyReportExistsErrorSchema` は `dailyReportId` を残す。汎用の `apiErrorSchema` は今までどおり code だけを読む
  - service は `vi.mock` しない
- `client.test.ts`
  - `env.AI.run` を差し替え、モデル ID が `@cf/google/gemma-4-26b-a4b-it` であること、`stream` が false であること、バインディングが無ければ `run` を呼ばず `no_secret` であること。本文は `choices[0].message.content`、それが空なら `response`。`reasoning` は本文にしない
  - 空の本文は `empty`、HTTP の失敗は `upstream`
  - テスト対象の関数を `vi.mock` しない。ログに本文が出ないことは、このテストでは見ない（`logJson` は service が失敗のときだけ呼ぶ）

ブラウザ（実装の最後。自動テストにはしない）:

- メモを2件選ぶと「日報を追加」が出る。0件では出ない。オフラインでは押せない。削除とグループ追加は今までどおり動く
- 作成日が同じメモは、その日が初期値。違う日が混ざると今日。種類を個人にすると、手で変えていなければ記録になる
- 作ると詳細に本文と先頭行がある。同じ日付・同じ種類でもう一度作ると、新しい本文にならず、その日報が開く。選んだ未材料だけが「まだ入っていない」になる。再読み込みするとその一覧は消える
- 足すと末尾に空行を挟んで繋がり、状態は変わらない。生成中の「作成」と「足す」はスピナーになる
- 一時保存は画面に残る。確定すると日報一覧へ戻る。確定から一時保存で下書きに戻る。空白だけでは保存できない
- メモを削除しても日報の本文は残る。日報を削除してもメモは残る
- カレンダーのマスに日報の印は無い。選んだ日の枠に「この日の日報」が出て、仕事と個人が横に並ぶ
- サイドバーの順は、メモ一覧、カレンダー、日報、設定

## 6. 実装順

1. `packages/shared` の契約と error code
2. スキーマとマイグレーション。SQL が `memos` を作り直していないことを見る
3. `heading`、`body`、`eligibility`、`prompt`、`constraint-error` の失敗するテストから、最小の実装
4. `findOwnedByIds` と、一覧・1本・保存・削除（生成しない経路）
5. 生成の前に出せる画面。一覧、編集の保存と削除、サイドバー
6. `client.ts` と AI バインディング。そのあと作成、足す、作り直し（回数の1文、戻す、`batch`）。モーダル、選択バーの「日報を追加」、編集の足すと作り直しはこのあと
7. `logging.md`、`line-security.md`、`db.md` を実装と揃える
8. ブラウザで、第5節の確認項目を見る

## 7. コミット前テスト実行

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @repo/api test`
- `pnpm build`
- 第5節のブラウザ確認

## 8. スコープ外

- 月報、職務経歴書、LINE からの作成、日報の LINE 通知
- フレームワークの自作、本文の検索、オフラインでの保存、表示のオンオフ
- カレンダーのマスへの日報の印
- 生成回数を、Worker が落ちたあとに戻す仕組み
- 画像を生成先へ渡すこと
- `memos` の削除上限（500）の変更
