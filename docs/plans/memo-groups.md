# プラン: メモのグループ

状態: プランレビュー（step 2）、テスト網羅のレビュー（step 3）、包括レビューの P1 を反映済み｜元資料: なし（チャットでの仕様合意）

## 1. 概要

メモを作業単位でまとめる「グループ」を追加する。メモ一覧画面にタブを置き、「メモ」と「グループ」を切り替えて表示する。メモタブでチェックしたメモを、既存のグループか、その場で作った新しいグループに入れられ、グループの画面から直接そのグループにメモを書ける。グループを削除すると、中のメモも一緒に削除する。

## 2. 背景

今のメモは `tag`（tweet / tech / todo / other）を1つ持つだけで、同じ作業に関するメモ同士をつなぐ仕組みがない。作業の途中で書いたメモが、他のメモと混ざって時系列に積まれるため、後からその作業のメモだけを見返しづらい。

## 3. 詳細設計

### 合意済みの仕様

グループの性格:

- グループは消えずに残る入れ物。一時的な作業単位としても、長く使う入れ物としても使う
- 持つ情報は名前だけ。1〜50文字（前後の空白は除く）。同じユーザーの中で同じ名前は作れない。重複は前後の空白を除いた完全一致で判定する（「Rust」と「rust」は別の名前）
- アーカイブと、それを戻す機能は作らない
- 「今このグループに入れている」状態（アクティブなグループ）は作らない

メモとの関係:

- 1つのメモが入るグループは0個か1個
- LINE はグループを扱わない。LINE から送ったメモは常にグループなしで保存する
- グループに入れたメモは、メモタブに表示しない。メモタブはどのグループにも入っていないメモだけになる
- todo（やること）のメモはグループに入れられない。グループの入力欄では todo を選べず、「グループに追加」では todo を入れない
- tech の週次まとめは、今まで通りタグだけで対象を決め、グループに入れた tech も対象に含める（グループに入れるのは整理であり、読み終えたことではないため）。todo の日次通知は、todo が常にグループなしなので影響しない。通知のコードは変えない

画面（メモ一覧画面 `/`）:

- 画面の上にタブ「メモ」「グループ」を置く。状態は検索パラメータで持ち、画面遷移はしない
  - メモタブ: `/`（または `/?view=memos`）
  - グループタブ: `/?view=groups`
  - グループを選んだ状態: `/?view=groups&group={groupId}`
  - ブラウザの「戻る」でグループ一覧に戻れる。再読み込みしても同じグループが開く
- 検索パラメータが合わないとき（`view` が不正な値、`view=memos` に `group` が付いている等）は、メモタブとして扱う
- メモタブ: 今のメモ一覧と同じ。チェックしたメモに対して、削除ボタンの隣に「グループに追加」を置く
  - 入れ先の選択欄には、既存のグループと「新しいグループを作る」を出す。グループが0個のときは「新しいグループを作る」だけを出す
  - 「新しいグループを作る」は、名前を入れると、グループを作ってからチェックしたメモを入れる。名前の重複は入力欄の下に「同じ名前のグループがあります」と出す。作成だけ成功して追加に失敗したときは「グループは作りましたが、メモを入れられませんでした」と出す（空のグループが残る。もう一度「グループに追加」で入れられる）
  - 確認ダイアログは出さずに入れる（入れ先を選ぶ操作が確認を兼ねる）。入れたあと「N 件を「{グループ名}」に入れました」と「開く」のリンクをトーストで出す。todo が混ざっていたら「やること M 件は入れませんでした」も添える
- グループタブ:
  - グループ一覧に、名前・メモ件数・最後にメモを入れた日時を出し、最後にメモを入れた順に並べる
  - 新しいグループは、グループタブと、メモタブの「グループに追加」の両方で作れる
  - グループが0個のときは「まだグループがありません」と「新しいグループを作る」を出す
  - PC では左にグループ一覧、右に選んだグループの中身を並べる。`group` が無いときは、先頭（最後にメモを入れた）グループを自動で開き、URL を `group` 付きに置き換える（履歴は増やさない）
  - スマホでは一覧と中身を入れ替えて表示し、中身の上に「← グループ一覧」を置く。`group` が無いときは一覧を出す（自動で開かない）。「← グループ一覧」は `?view=groups` への遷移にする（`history.back` にしない。URL を直接開いたあとにアプリの外へ戻らないため）
  - URL の `group` が存在しないとき（削除済みのグループの URL に「戻る」で戻った、別の端末で削除された等）は、URL を `/?view=groups` に置き換えて一覧に戻し、「グループが見つかりません」とトーストを出す
- グループの中身:
  - チャットのように、メモを古い順に上から並べて日付で区切り、下端に入力欄を固定する（実装後の見直しで変更）。入力欄はグループ専用の部品で、タグの選択肢から todo を外す。ここで書いたメモはそのグループに入る
  - 入力欄は常に表示する（グループに書き足すのが主な使い方のため）。「キャンセル」ボタンは出さない。Enter は改行、⌘ / Ctrl + Enter で送る
  - 送信に成功したら、本文を消す（消さないと、もう一度押したときに同じメモが二重に保存される）
  - 入力欄は未送信リストを通さず、直接サーバーに送る。送信に失敗したら本文を入力欄に残し、「保存できませんでした」とトーストを出す。送る途中でグループが消えていたら、「グループが見つかりません」とトーストを出して一覧に戻す
  - 検索欄は置かない
  - 置く操作は「名前を変更」と「グループを削除」だけ。中のメモを1件ずつ操作する機能（外す・移す・削除）は作らない
  - 「グループを削除」は、グループと中のメモをまとめて削除する。画像のメモは R2 の画像も消す。確認ダイアログに「メモ N 件も削除されます」と件数を出す。0 件のときは件数を出さず「このグループを削除します」とする。削除したら URL を `/?view=groups` に置き換える（「戻る」で削除済みのグループに戻らないため。PC では先頭のグループが自動で開く）

入れ間違い:

- 間違ったグループにメモを入れたとき、戻す手段は用意しない（合意済み。取り出すにはグループごと削除するしかなく、そのときメモも失う）

オフライン:

- グループはオンラインでだけ使う。オフラインでは、グループタブ全体に「オフラインのためグループは使えません」と出す。メモタブの「グループに追加」も無効にする
- オフラインで書くメモはメモタブから入れ（今の未送信リストの仕組みのまま）、オンラインに戻ってから「グループに追加」で入れる
- 未送信リストは変えない（`groupId` を持たせない）

その他:

- グループの中身のメモはチャットのように古い順に並べ、開いたときと書き足したときは最新（下端）を見せる。タグの絞り込みは置かない
- 「最後にメモを入れた日時」は、グループの作成時と、メモを入れた時（「グループに追加」とグループの入力欄からの作成）に更新する。メモの `createdAt` ではない
- サイドバーの件数:
  - 「メモ一覧」: メモタブと同じく、どのグループにも入っていないメモの件数
  - 「今週の技術」: 通知 API がすでに返している `pendingCount`（次の週次通知で送る tech の件数。グループに入れた tech も数える）。今の「tech の総数」から意味が変わり、週次通知を送るたびに 0 に戻る
  - 「やること」: 今のまま（todo は常にグループなしなので、メモタブの todo の件数と通知の対象が一致する）
- 「グループに追加」は、どのグループにも入っていない、todo 以外のメモだけを対象にする。すでにグループに入っているメモと todo の id が混ざっていたら、そのメモは数えずに無視し、todo の件数は別に返す
- グループ一覧の件数と並び順は、メモを入れたあと・グループを作ったあと・削除したあとに取り直す

### 機能境界

- `groups` テーブルは `groups` の機能、`memos` テーブル（`group_id` 列を含む）は `memos` の機能が持つ（`.agents/rules/architecture.md` の「他機能のテーブルへ直接クエリしない」）
- 依存は `groups` → `memos` の一方向にする。`groups` の service が `memos` の service を呼ぶ。`memos` の service は `groups` を import しない（循環を避ける）
- このため、グループに関わる API（グループへのメモの作成・追加・中身の取得・削除）は、すべて `/api/groups/:id/...` に置く。`groups` の service が持ち主を確かめてから、`memos` の service を呼ぶ
- `POST /api/memos` は変えない。旧版のクライアントや LINE からの保存は、従来どおりグループなしで保存される

### 認可

- `/api/groups*` の全ルートで、先頭で `readSessionUserId` を呼び、無ければ 401 を返す（既存の `/api/memos*` と同じ）。`.agents/rules/line-security.md` の対象一覧に `/api/groups*` を足す
- `:id` のグループは、`groups.user_id = セッションのユーザー ID` で引く。存在しない場合と他人のグループの場合は、区別せず同じ 404 にする（存在を推測させない）
- メモへの操作は、`memos` の service の既存の流儀どおり `memos.user_id` で絞る。他人のメモの id が混ざっても、数えずに無視する
- グループの id はサーバーで `nanoid()` で作る（`memos` と同じ）。`:id` は空でない 64 文字以下の文字列として検査する（`groupIdSchema` として `packages/shared/src/group.ts` に書き出す）
- ルートで検査する順番は「セッションの確認（401）→ `:id` と本文の検査（400）→ 持ち主の確認（404）」に揃える。DB に触るのは 400 の検査のあと
- グループは URL の `:id` だけで決める。本文に `groupId` などの余分なキーがあっても、Zod の parse で捨てる

### 変更するファイル（見込み）

契約（先に直す）:

- `packages/shared/src/group.ts` — 新規。
  - `groupSchema`（`id`, `name`, `memoCount`, `lastAddedAt`, `createdAt`）、`groupListResponseSchema`
  - `createGroupRequestSchema` / `renameGroupRequestSchema`（`name`: trim 後 1〜50 文字）
  - `assignMemosRequestSchema`（`ids`: 1〜`MAX_BULK_DELETE` 件）と応答 `assignMemosResponseSchema`（`added`、`skippedTodo`）
  - `deleteGroupResponseSchema`（`deletedMemos`）
  - `createGroupMemoRequestSchema` — 既存の `createMemoRequestSchema` の `tag` から `todo` を除いたもの（todo は 400）
- `packages/shared/src/error.ts` — 新規。エラー本文 `apiErrorSchema`（`message` と、任意の `code`）。`code` は今回 `"group_not_found"` だけ。既存の `{ message }` の本文とも互換にする。知らない `code` は拒まずに「`code` 無し」として読む（将来 `code` を足しても、旧版の Web がエラー本文を読めるようにするため）

API（`groups` を新設。`index` / `service` / `repository` の3層）:

| ルート | 内容 |
| --- | --- |
| `GET /api/groups` | 自分のグループ一覧。件数は `memos` の service の `countByGroupForUser` から取り、`last_added_at` の降順で返す |
| `POST /api/groups` | 作成。名前の重複は 409 |
| `PATCH /api/groups/:id` | 名前の変更。重複は 409 |
| `DELETE /api/groups/:id` | グループと中のメモを削除（下の「グループの削除」） |
| `GET /api/groups/:id/memos` | グループのメモを新しい順に返す。`memos` の service の一覧を `groupId` 指定で呼ぶ |
| `POST /api/groups/:id/memos` | グループへのメモの作成。`memos` の service の `createForUser` を `groupId` 付きで呼ぶ |
| `POST /api/groups/:id/memos/assign` | 「グループに追加」。`memos` の service の `assignGroupForUser` を呼ぶ |

- グループが無い（他人のものを含む）ときは 404 で、本文は `{ message: "group not found", code: "group_not_found" }`
- `apps/api/src/features/groups/name.ts` — 新規。名前の重複エラー（`(user_id, name)` の一意制約違反）かどうかを判定する純粋関数
- `apps/api/src/features/memos/service.ts`:
  - `listForUser` — 既定でグループなし（`group_id IS NULL`）だけを返す。`groupId` を渡すとそのグループのメモだけを返す
  - `createForUser` — 任意の `groupId` を受け取り、`memos.group_id` に入れる。挿入が `group_id` の参照違反で失敗したら（持ち主の確認のあとにグループが消えた場合）、`save_failed` ではなく `group_missing` を返す。`groups` の index はこれを 404 と `code: "group_not_found"` にする
  - `assignGroupForUser(env, userId, groupId, ids)` — 新規。`user_id` が一致し、`group_id IS NULL` で、タグが todo でないメモだけに `group_id` を付ける。付けた件数と、除いた todo の件数を返す。D1 のバインド変数の上限（100）に合わせ、既存の削除と同じく 90 件ずつ分けて UPDATE する。UPDATE が `group_id` の参照違反で失敗したら（持ち主の確認のあとにグループが消えた場合）、`group_missing` を返す。`groups` の index はこれを 404 と `code: "group_not_found"` にする
  - `countByGroupForUser(env, userId)` — 新規。グループごとの件数を返す
  - `deleteInGroupStatement(db, userId, groupId)` — 新規。`user_id` と `group_id` を条件にメモを消す DELETE 文を、実行せずに返す（`RETURNING` で id と画像キーを受け取る）。`groups` の service が自分の DELETE 文と一緒に `db.batch` で実行するため
  - `deleteImagesForUser(env, userId, rows)` — 新規。消したメモの画像を、既存の `deleteManyForUser` と同じく R2 から1件ずつ消す（既存の処理をこの関数に切り出して共用する）
- `apps/api/src/features/memos/constraint-error.ts` — 新規。`group_id` の参照違反（`FOREIGN KEY constraint failed`）かどうかを判定する純粋関数。`idempotency.ts` の `isPrimaryKeyConflict` と同じく、drizzle のエラーの `cause` を辿る。実際の文字列は `wrangler dev --local` で確かめる
- `apps/api/src/features/memos/idempotency.ts` と `repository.ts` — `MemoRow` と `findMemoWithOwner` に `groupId` を足す。同じ id での再送の判定は、入力が `groupId` を持つときだけ `groupId` の一致も比べる（違えば 409）。入力が `groupId` を持たないときは比べない（グループなしで保存したあと、別の端末で「グループに追加」されたメモの再送を、衝突にしないため）
- `apps/api/src/features/groups/index.ts` — `POST /api/groups/:id/memos` で新規作成（201）かつ URL のメモなら、既存の `POST /api/memos` と同じく `waitUntil(captureOgpForMemo)` で OGP を取りに行く（OGP の取得は service ではなくルート側にあるため。足さないと、グループの入力欄で書いた URL メモにサムネイルが付かない）
- `apps/api/src/features/groups/touch.ts` — 新規。`last_added_at` を更新するかどうかを決める純粋関数
- `apps/api/src/features/groups/service.ts` — `last_added_at` の更新は、メモの作成が新規（`created: true`）のときと、`assignGroupForUser` が1件以上付けたときだけ行う（判断は `touch.ts`）。この更新に失敗しても、メモの保存は済んでいるので成功として返し、ログだけ残す（並び順がずれるだけで、データは壊れない）
- LINE webhook と通知は変えない

グループの削除（`DELETE /api/groups/:id`）:

1. 持ち主を確かめる（無ければ 404）
2. `memos` の service の `deleteInGroupStatement` と、`groups` の repository のグループの行の DELETE 文を、この順で1回の `db.batch` で実行する
3. batch が成功したら、`memos` の service の `deleteImagesForUser` で、消したメモの画像を R2 から消す
4. batch が失敗したら 500 を返し、ログを残す

- D1 の `batch()` はトランザクションとして実行され、1文でも失敗すると全体が元に戻る（Cloudflare の D1 のドキュメント「Batched statements are SQL transactions」）。このため、メモだけ消えてグループが残る途中の状態はできない。メモの削除とグループの行の削除の間に別のメモが割り込むこともない
- `memos.group_id` の参照は、既存と同じ `onDelete: restrict` にする。グループが無いのに `group_id` を持つメモは DB が作らせない
- R2 の削除に失敗した画像は、既存の `deleteManyForUser` と同じく、ログを残して先へ進む（持ち主の行が無い画像が残る。後で掃除する仕組みは今回作らない）

DB:

- マイグレーション（前進のみ、`.agents/rules/db.md`）:
  - `groups` を追加する（`id`, `user_id`（`users.id` を参照、`onDelete: restrict`）, `name`, `created_at`, `last_added_at`、`(user_id, name)` に一意制約）
  - `memos` に `group_id`（NULL 可、`groups.id` を参照、`onDelete: restrict`）と、`(user_id, group_id)` の索引を追加する
- 生成された SQL が `CREATE TABLE groups`、`ALTER TABLE memos ADD group_id ...`、`CREATE INDEX` だけで、`memos` を作り直していないことを確かめてから適用する（`docs/backend-setup.md` の「生成した SQL を確認してから適用」）

デプロイの順序と互換:

- PR をマージする前に、人が手元で `pnpm --filter @repo/api db:migrate:remote` を実行する（`docs/backend-setup.md`。CI はマイグレーションを実行しない。AI のセッションでは実行しない）。逆の順にすると、新しい API が無い列を参照し、メモ一覧と作成が SQL エラーで止まる
- マイグレーション済みで API が旧版の状態は問題ない。追加するのは NULL 可の列と新しいテーブルだけで、旧 API は列を明示して読み書きしている
- 旧版の Web・旧版の未送信リストは `POST /api/memos` だけを使うので、グループなしで保存される

ログ（`.agents/rules/logging.md`）:

| event | status | キー | いつ |
| --- | --- | --- | --- |
| `group.delete` | `failed` | `userId`, `groupId` | 削除の batch が失敗したとき |
| `group.touch` | `failed` | `userId`, `groupId` | `last_added_at` の更新に失敗したとき |
| `memo.create` | `group_missing` | `userId`, `memoId`, `groupId` | グループへの作成が、持ち主の確認のあとにグループが消えたため受け付けられなかったとき |
| `group.assign` | `group_missing` | `userId`, `groupId`, `count` | 「グループに追加」が、持ち主の確認のあとにグループが消えたため受け付けられなかったとき |

- グループ名はユーザーの入力なので、ログに出さない。`groupId` だけを出す
- 既存の `memo.image.delete` の失敗ログに `userId` を足す（R2 のキーは `{userId}/{memoId}` なので、残った画像を探すのに要る）
- `logging.md` の標準キーの表に、`group.delete` / `group.touch` / `group.assign` の event と `groupId` のキーを足す

Web:

- `routes/_app/index.tsx` — 検索パラメータ `view`（`memos` / `groups`）と `group` を受け取り、タブを切り替える。検査は `routes/login.tsx` と同じく手書きの関数で行う（Web は zod を直接の依存に持たず、lockfile を変えないため）。`view` が不正な値ならメモタブとして扱う
- `features/groups/api/` — グループの API 呼び出し。エラー本文は `apiErrorSchema` で読む
- `features/groups/components/` — グループ一覧、グループの中身、作成・名前変更・削除のダイアログ
- `features/memos/components/memo-list.tsx` — 選択時の操作に「グループに追加」を足す（入れ先の選択欄、新しいグループの作成、結果のトースト）
- `features/memos/components/memo-composer.tsx` — 選べるタグを外から渡せるようにする（グループの入力欄では todo を外す）。今の部品は自分では本文を消さず（メモタブは部品ごと閉じて本文を捨てている）、`onCancel` が必須なので、次の2つを足す: 送信に成功したら本文を消せるようにする。`onCancel` を任意にし、無いときは「キャンセル」を出さない
- `routes/_app.tsx` — サイドバーの「今週の技術」の件数を、`["notifications"]` の `pendingCount` から取る
- `features/memos/components/memo-list.tsx` と `features/memos/offline/flush.ts` — 今は作成・削除・送信のあとに `["memos"]` だけを取り直している。「今週の技術」の件数が通知 API から来るようになるので、あわせて `["notifications"]` も取り直す（取り直さないと、メモタブで tech を書いても消しても件数が変わらない）
- 取得のキー:
  - `["memos"]` — グループなしのメモ（メモタブとサイドバー）
  - `["groups"]` — グループ一覧
  - `["groups", groupId, "memos"]` — グループの中身
  - グループへのメモの作成・「グループに追加」・グループの削除のあとは、`["memos"]`、`["groups"]`（前方一致でグループの中身も含む）、`["notifications"]` を取り直す
- グループの入力欄からの送信は `features/groups/api/` から直接 `POST /api/groups/:id/memos` を呼ぶ。未送信リスト（`features/memos/offline/`）は変えない
- 404 で本文の `code` が `"group_not_found"` のときは、URL を `/?view=groups` に置き換えて「グループが見つかりません」と出す（状態コードだけでは判定しない）

## 4. テスト影響範囲

- 既存の `memos/index.test.ts` は 401 と Zod の 400 だけを見ているため、`POST /api/memos` を変えない今回は影響しない
- `memos/idempotency.test.ts` — `decideCreateResult` の入力に `groupId` が増えるため、既存のケースの引数を合わせる
- 通知（`notifications/*`）は変えないため、テストも変えない

## 5. 新規テストケース

単体（Vitest。`.agents/rules/testing.md` に従い、D1 と R2 は立てない。テスト対象の関数を `vi.mock` で差し替えない）:

置き場所: `packages/shared` にはテストを実行する仕組みが無く、Vitest は `apps/api/src/**/*.test.ts` だけを実行する。共有の Zod のテストは、既存の `createMemoRequestSchema` と同じく API 側に置く（`group.ts` と `error.ts` の Zod は `apps/api/src/features/groups/index.test.ts`）。

- `group.ts` の Zod（`groups/index.test.ts`）:
  - `createGroupRequestSchema` と `renameGroupRequestSchema` の `name`:
    - 前後の空白を除いて 0 文字は不可。空白だけは不可
    - 1 文字と 50 文字は可、51 文字は不可
    - `"  Rust  "` → parse の結果が `"Rust"`（trim された値が保存される）
    - 前後に空白を付けた 50 文字 → 可（trim してから長さを数える）
  - `createGroupMemoRequestSchema`:
    - tag が `todo` なら不可、`tweet` / `tech` / `other` は可
    - `{ tag: "tweet", content: "  眠い  ", groupId: "g_other", userId: "u2" }` → `{ tag: "tweet", content: "眠い" }`（本文の `groupId` などを捨てる）
    - 空白だけの `content` は不可
  - `assignMemosRequestSchema` の `ids`: 0 件は不可、1 件と `MAX_BULK_DELETE` 件は可、`MAX_BULK_DELETE + 1` 件は不可
  - `groupIdSchema`: 64 文字は可、65 文字と空文字は不可
- `error.ts` の Zod（`groups/index.test.ts`）: `code` 付きと `code` 無しの `{ message }` の両方を読める。知らない `code` は `code` 無しとして読む
- `groups/name.test.ts`:
  - `cause` に `(user_id, name)` の一意制約違反を持つエラー → 真（文字列は `wrangler dev --local` で確かめた実際の形を使う）
  - ラップ側の message だけに `"UNIQUE constraint failed: groups.user_id, groups.name"` を含み、`cause` は別のエラー → 偽（グループ名が params として message に入るため、message を見ない）
  - `memos.id` の主キーの重複、他の制約違反 → 偽
- `memos/constraint-error.test.ts`:
  - `cause` に参照違反を持つエラー → 真
  - `cause` の無い生のエラーで、message に `"FOREIGN KEY constraint failed"` → 真（既存の `isPrimaryKeyConflict` の「unwrapped error」と同じ扱い）
  - ラップ側の message だけに `"FOREIGN KEY constraint failed"` を含み、`cause` は NOT NULL 違反 → 偽（メモ本文が params として message に入るため）
  - 主キーの重複、一意制約違反 → 偽
- `memos/idempotency.test.ts` の `decideCreateResult`:
  - 入力に `groupId` 無し、既存が `groupId` 付き、本文とタグは同じ → 既存（衝突にしない）
  - 入力に `groupId` 有り、既存と同じ → 既存
  - 入力に `groupId` 有り、既存と違う、または既存が `groupId` 無し → 衝突
- `groups/touch.test.ts`:
  - 作成で `created: true` → 更新する。`created: false`（同じ id の再送で既存を返した）→ 更新しない
  - 「グループに追加」で `added = 0` → 更新しない。`added = 1` → 更新する
- `groups/index.test.ts`（ルート。既存の `notifications/index.test.ts` と同じく `Jwt.sign` で `sid` を作り、env は `SESSION_SECRET` だけ）:
  - 全ルートで、セッションが無ければ 401
  - セッション付きで、65 文字の `:id` → `GET /:id/memos`・`PATCH /:id`・`DELETE /:id`・`POST /:id/memos`・`POST /:id/memos/assign` のすべてで 400
  - セッション付きで、`POST /api/groups` と `PATCH` の不正な本文、`POST /:id/memos` の不正な本文（todo を含む）、`assign` の不正な `ids` → 400

ブラウザでの確認（`wrangler dev --local` に別のユーザーのデータを作って確かめる。自動テストにしないもの）:

- 【P0】他人のメモの id を混ぜた「グループに追加」: DevTools の fetch で `assign` に他人のメモの id を混ぜて送る。`added` にも `skippedTodo` にも数えず（他人の todo も数えない）、他人のメモの `group_id` は NULL のまま
- 他人のグループ・存在しないグループへの `PATCH`・`DELETE`・`GET /:id/memos`・`POST /:id/memos`・`assign` のすべてが 404 で、本文が `code: "group_not_found"` であること。相手のグループに何も書かれていないことを D1 で確かめる
- 名前の重複が 409 になること
- すでにグループに入っているメモの id を DevTools で `assign` に送る → 移動せず、`added` に数えない
- 「グループに追加」でグループなしのメモだけが入り、メモタブから消え、`last_added_at` と並び順が変わること
- todo のメモを含めて「グループに追加」すると、todo が入らず、トーストに件数が出ること
- グループの削除で、中のメモと画像が消え、他のグループとグループなしのメモが残ること
- 削除のダイアログ: メモ 0 件のグループは「このグループを削除します」、1 件以上は「メモ N 件も削除されます」。削除のあと「戻る」を押しても削除済みのグループに戻らず、PC では先頭のグループが開く
- タブ A でグループを開いたまま、タブ B でそのグループを削除し、A の入力欄から送る → 「グループが見つかりません」のトーストが出て `/?view=groups` に戻る
- 検索パラメータ:
  - `?view=foo`、`?view=memos&group=x` → メモタブ
  - PC で `?view=groups` → 先頭のグループが開き、URL が置き換わる（「戻る」で履歴が1つ前に戻る）
  - スマホ幅で `?view=groups` → 一覧だけが出て、自動で開かない
  - 「← グループ一覧」 → `?view=groups` に遷移する（URL を直接開いたあとでも、アプリの外へ戻らない）
  - 再読み込み → 同じグループが開く
  - 削除済みのグループの URL を開く → 一覧に戻ってトーストが出る
- サイドバー: 「メモ一覧」の件数はグループなしのメモだけを数える。「今週の技術」は、グループの入力欄で書いた tech でも 1 増える（`pendingCount`）
- グループの入力欄: タグに todo が出ない。入力欄が常に表示され、「キャンセル」が出ない。送信に成功したら本文が消え、書いたメモがそのグループの先頭に来る。送信に失敗したとき（DevTools で `/api/groups/*/memos` を遮断）、本文が残り「保存できませんでした」が出る
- グループの入力欄で URL だけのメモを書くと、しばらくしてサムネイルが付くこと
- メモタブで tech のメモを書く・消すと、サイドバーの「今週の技術」の件数が変わること
- メモタブの「グループに追加」からの作成:
  - グループが 0 個のとき、選択欄に「新しいグループを作る」だけが出る。グループタブには「まだグループがありません」が出る
  - 既にある名前を入れると、入力欄の下に「同じ名前のグループがあります」が出る
  - 作成だけ成功して追加に失敗したとき（DevTools で `assign` を遮断）、「グループは作りましたが、メモを入れられませんでした」が出て、空のグループが残る
  - トーストの「開く」で、入れたグループが開く
- オフラインでグループタブが使えず、メモタブの「グループに追加」が無効になること

確かめられないもの（自動テストでもブラウザでも再現できない）:

- 持ち主の確認と挿入・UPDATE の間にグループが消える `group_missing` の競合。判定の部分だけを `constraint-error.test.ts` で守る
- `last_added_at` の更新に失敗しても成功を返すこと。判断の部分だけを `touch.test.ts` で守る

## 6. 実装順

1. 契約（`packages/shared` の `group.ts` と `error.ts`）と、その Zod のテスト: 型の定義だけで判断が少ないため、安価なモデル（Sonnet）のサブエージェントに任せる
2. マイグレーションと `groups` の repository: 同上（Sonnet のサブエージェント）。生成された SQL が `memos` を作り直していないことを確かめる
3. `memos` の service と repository の追加（一覧の既定、`groupId` 付きの作成、`assign`、件数、グループ単位の削除の文と画像の削除）、`constraint-error.ts`、`idempotency.ts` の変更とテスト: 既存の作成と冪等の判定に手を入れるため、上位モデル（Opus）がメインのセッションで実装する
4. `groups` の service と index とテスト（削除の batch、OGP の取得）、ログ、`line-security.md` と `logging.md` の更新: 認可と削除の手順が中核のため、上位モデル（Opus）がメインのセッションで実装する
5. Web のタブと検索パラメータ、グループ一覧と中身（PC の左右2段、スマホの入れ替え）: 見た目の判断が多いため、上位モデル（Opus）がメインのセッションで実装し、`design-taste-frontend` スキルと `docs/design-system.md` に合わせる
6. メモタブの「グループに追加」（入れ先の選択欄、その場でのグループの作成と追加の2段の処理、途中で失敗したときの表示、結果のトースト）: 作成と追加の2段の処理と途中失敗の扱いがあるため、上位モデル（Opus）がメインのセッションで実装する
7. サイドバーの「今週の技術」の件数の切り替え、メモタブと未送信リストでの `["notifications"]` の取り直し、オフライン時の無効化: 小さな変更のため、Sonnet のサブエージェントに任せる
8. 実装の観点別レビュー: `design-reviewer`、`edge-case-reviewer`、`security-reviewer` の3体（いずれも Opus）を並列で起動し、P0・P1 を直す（`.agents/rules/review.md`）
9. マージ前に、人が `pnpm --filter @repo/api db:migrate:remote` を実行する（AI のセッションでは実行しない）

## 7. コミット前テスト実行

- ローカルのマイグレーション `pnpm --filter @repo/api db:migrate:local` と、生成された SQL の目視確認
- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @repo/api test`
- `pnpm build`
- ブラウザで、作成 → メモタブから追加 → グループの入力欄から追加 → 名前変更 → 削除の流れと、スマホ幅の表示、5章の「ブラウザでの確認」を確かめる

## 8. スコープ外

- オフラインでのグループの利用（一覧・中身の表示、グループへの書き込み）
- グループ内のメモの検索とタグの絞り込み
- todo のメモをグループに入れること

- 似た意味のメモを探してグループに入れる機能（RAG 検索）。手動で使ってみて足りないとわかってから、別のプランで Workers AI と Vectorize を使って作る
- LINE からのグループ操作
- アクティブなグループ
- グループのアーカイブ
- グループ内のメモの個別操作（外す・移す・削除）
- 1つのメモを複数のグループに入れること
