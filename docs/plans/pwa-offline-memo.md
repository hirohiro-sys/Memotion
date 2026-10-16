# プラン: PWA 化とオフラインでのメモ追加

状態: レビュー中｜元資料: なし（チャットでの仕様合意）

## 1. 概要

Memotion を PWA として iPhone（Safari のホーム画面追加）と Mac（Safari の Dock 追加、Chrome のインストール）から使えるようにする。オフラインでもメモを追加でき、追加分は端末内のキューに溜まり、一覧に「送信待ち」と表示される。オンラインに戻ると自動で送信する。設定画面に導入手順とオフライン時の動作の説明を載せる。

## 2. 背景

電車や圏外でもメモを取りたい。現状の Web は `POST /api/memos` をオンライン前提で呼ぶだけで、送信に失敗しても、入力欄に文章が残るだけである（画面を離れると失われ、再送も手作業になる）。また、Service Worker が無いため、圏外ではアプリの画面そのものが開けない。`manifest.webmanifest` とアイコンは既にあるが、Service Worker とオフライン用の保存先が無い。

## 3. 詳細設計

### 合意済みの仕様

- オフラインでできるのはメモの追加のみ。削除・編集は対象外
- 追加できるのはテキストのみ。画像は対象外。OGP の取得など、サーバー側の後処理は同期後に走る
- キュー内のメモは一覧の先頭に「送信待ち」バッジ付きで表示する
- 送信のタイミングは、アプリ起動時、`online` イベント、フォーカス復帰（`visibilitychange` で visible になったとき）の全部
- 二重送信は、クライアントが生成した UUID を冪等キーにして防ぐ
- ログイン期限切れ（401）のときはキューを保持し、ログイン後に再送する
- アプリの更新は、新版を検知したら待機せず有効化し、ページを再読み込みして新版に揃える（入力中の文章は破棄されてよい）
- 設定画面に、iPhone / Mac(Safari) / Mac(Chrome) の導入手順を全部並べる（折りたたみ）。オフライン時の動作の説明も載せる

### 変更するファイル

契約（先に直す）:

- `packages/shared/src/memo.ts` — `createMemoRequestSchema` に任意の `id` を追加。形式は UUID v4 のみ（`z.uuidv4()` 相当）。任意にするのは、旧版のクライアントも動かすため。推測できる ID による先取りと、存在判定を防ぐため v4 に限る。あわせて、端末でメモを書いた時刻として、任意の `createdAt`（ISO 8601 の日時文字列。UTC 以外のオフセット付きも受理）を追加する。保存するときは `resolve-created-at.ts` が、`toISOString()` の形（UTC、`Z` 付き、ミリ秒付き）に正規化する（DB は `createdAt` を文字列として並べ替え・比較しているため、形を揃える必要がある）。オフラインで書いたメモを、同期した時刻ではなく書いた時刻で保存するため

API:

- `apps/api/src/features/memos/idempotency.ts` — 新規。DB に触れない純粋関数。次の 2 つを持つ。(1) `isPrimaryKeyConflict(error)`: エラーが `memos.id` の主キー重複かどうかを判定する。drizzle のエラー（`DrizzleQueryError`）は `message` が `Failed query: ...`（SQL と本文を含む）で、`UNIQUE constraint failed` は `error.cause` の側にあるため、`cause` を辿って判定する。`line_message_id` など他の一意制約違反は含めない。既存の `isUniqueConstraintError`（`error.message` しか見ない）は使わない。D1 が返す実際の文字列は、実装時に `wrangler dev --local` で確かめる。エラーオブジェクトは、本文が入るためログに渡さない。(2) `decideCreateResult(saveResult, existing, input, userId)`: 保存の結果（成功／主キー重複／その他のエラー）と、主キー重複のときに引いた既存行（`ExistingMemoRow`。`MemoRow` に `userId` を足した型）から、service が返す結果（作成・既存・衝突・`save_failed`）を決める。成功なら作成。主キー重複で、既存が引けないなら `save_failed`。主キー重複で、既存が自分の行かつ本文とタグが同じなら既存。それ以外の主キー重複は衝突。その他のエラーは `save_failed`。比較は契約で `trim` 済みの値同士で行い、`createdAt` は比べない。service の戻り値の `created`（作成か既存か）は、この結果から導く。レスポンスコードへの対応（201・200・409・500）は index.ts の薄い対応にとどめる
- `apps/api/src/features/memos/resolve-created-at.ts` — 新規。DB に触れない純粋関数。入力の `createdAt` と現在時刻から、保存する時刻を決める。無ければ現在時刻。返す値は常に `toISOString()` の形に正規化する。現在時刻より 5 分を超えて未来なら、端末の時計のずれとみなして現在時刻にする（過去側には下限を設けない。長くオフラインだった場合を許す）。`now` は引数で渡す（`testing.md`）
- `apps/api/src/features/memos/service.ts` — `createForUser` が `input.id` を受け取れば `memos.id` に使う。無ければ従来どおり `nanoid()`。保存時刻は `resolve-created-at.ts` で決める。保存で例外が出たら `isPrimaryKeyConflict` で見分け、それ以外は従来どおり `save_failed`。主キー重複のときは repository で id から行を引き、`idempotency.ts` で判定する。戻り値の型は `{ ok: true; memo; created: boolean }` と、`error` に `"conflict"` を足した形にする
- `apps/api/src/features/memos/index.ts` — 新規は 201、自分の既存を返すときは 200、衝突は 409（既存メモの内容は返さない）。`index.ts` にロジックは書かず、service の戻り値で分岐する。OGP は新規作成（201）のときだけ `waitUntil` で走らせる。200 のときは再実行しない。取りこぼしは既存の `backfillOgpForUser` に任せる
- `apps/api/src/features/memos/repository.ts` — id でメモを引く関数を追加。返す列は `MemoRow` と同じ（tag は join）で、`userId` も含める
- マイグレーションは不要（既存の主キー制約を冪等キーに使う）
- 再送・衝突のログは、`event: "memo.create"`、`status: "duplicate"` または `"conflict"`、`memoId` のみ。本文は出さない。成功のたびにはログを出さない（`logging.md`）。この `event` は標準キーの表に無いため、`.agents/rules/logging.md` の表にも足す

Web（`apps/web/src/features/memos/` 配下に offline 系を追加）:

- `offline/outbox.ts` — 新規。IndexedDB のキュー（追加・一覧・削除・状態更新）。1件 = `{ id, userId, tag, content, createdAt, status }`。`createdAt` は端末でメモを書いた時刻で、そのまま API に送る。`status` は `pending` / `failed`。保存先は IndexedDB のデータベース `memotion`、ストア `outbox`（キーは `id`）。メモを積むときの `userId` には、`features/auth/` が端末に保存している前回のユーザー ID を使う（オフラインでも読める）
- `offline/flush.ts` — 新規。キューを `createdAt` の古い順に1件ずつ送る。`status` が `failed` の項目は飛ばして、次の項目を送る。引数で `queryClient` を受け取り、結果（完了／再試行／未認証）を返す。1件ずつの POST には 10 秒のタイムアウトを付け、超えたら再試行として中断する（応答が来ない送信が、ロックを握り続けるのを防ぐ）。ユーザー ID が、端末に保存されているログイン中のユーザー ID と一致する項目だけ送る。返事ごとの扱いは下表。複数タブの同時実行は `navigator.locks`（ロック名 `memotion-outbox-flush`）で避ける。送信後、1件でもキューから消えたら `["memos"]` のクエリを更新する（`invalidateQueries`）。ログに本文を出さない
- `offline/use-outbox-sync.ts` — 新規。起動時・`online`・フォーカス復帰で flush を呼ぶ（トリガーの責務だけ）。`_app.tsx` のレイアウトで1回だけ使い、メモの追加後にすぐ送るための `requestFlush` も返す。flush は `navigator.locks` で直列化されるため、トリガーが重なっても二重に動かない。オンラインのまま 5xx・429・タイムアウトなどで再試行になった場合は、キューに残したまま、次のトリガー（起動・`online`・フォーカス復帰）を待つ。タイマーによる再試行は入れない（別アプリから戻る操作で十分に送られ、メモは失われないため）。flush が 401 を返したら、`router.invalidate()` で `_app.tsx` の `beforeLoad` をやり直す（そこで `/api/me` が 401 を返してログイン画面へ移る。端末のユーザー ID もそこで消える）
- `offline/use-outbox.ts` — 新規。キューを購読する hook（購読の責務だけ）
- `offline/use-online-status.ts` — 新規。`navigator.onLine` と `online` / `offline` イベントを購読する hook。コンポーザー（タグの隠し方）とサイドバー（件数の「-」）が使う
- `offline/merge-pending.ts` — 新規。送信待ちのメモと取得済みのメモを合成し、取得済みに同じ `id` があれば、送信待ちのほうを隠す（クライアントが付けた `id` がそのままサーバーの `id` になるため、送信成功の直後に一瞬重複したり消えたりしない）。タグのフィルタ・検索に掛ける純粋関数。`memo-list.tsx` の肥大を防ぐ
- `api/create-memo.ts` — `id` と `createdAt` を付けて送る。戻り値は判別できる型にし、ステータスを呼び出し側が分けられるようにする: 成功（201 は作成、200 は既存。どちらも成功扱い）、再試行（通信失敗・5xx・429。`fetch` の例外もここで受けて再試行にする）、未認証（401）、拒否（その他の 4xx。400・409 を含む。ステータスを持つ）。通信失敗には、408 も含める。200・201 の本文は `memoSchema` で検査し、検査に通らないとき、またはリダイレクトされていたときは、保存済みとせず再試行にする（リダイレクト先のログイン画面などを保存済みと取り違えないため。同じ id で再送するのでサーバーでは重複しない）。従来の画面からの直接送信（キューを使えない場合）は、この関数の結果が成功以外のとき例外に変えて、`useMutation` の `onError`（「保存できませんでした」のトースト）に渡す。直接送信での 401 は、キュー経由と同じく `router.invalidate()` でログイン画面へ移す
- `components/memo-list.tsx` — 追加はまずキューに積み、すぐ `requestFlush` を呼ぶ（オンラインでも同じ経路）。キューへの保存（IndexedDB）に失敗したときは、オンラインなら従来どおり直接送る。オフラインなら「このブラウザではオフラインでの追加が使えません」と表示する。キュー経由では、400 は「送信できません」のバッジになり、従来の「保存できませんでした」のトースト（`onError`）は、直接送る場合だけ出る。送信待ちは `tagCounts` と「すべて」の件数に含めない（件数は取得済みのメモだけ）。送信待ちのメモを先頭に出す。選択・一括削除の対象にはしない。取得が待機中（オフライン）のときはスケルトンを出さず、「オフラインのため既存のメモは表示できません」と注記して、送信待ちだけを出す
- `components/memo-card.tsx` — 「送信待ち」「送信できません」のバッジと破棄ボタン（実装では `pending-memo-card.tsx` に分けた）
- `components/layout/sidebar.tsx` と `routes/_app.tsx` — オフライン（`use-online-status` が false、または取得が待機中でデータが無い）のとき、メモの件数と通知の状態を「-」にし、スケルトンを出さない。`settings-view.tsx` も、通知設定の取得が待機中（オフライン）のときは、スケルトンではなく「オフラインのため設定を取得できません」と表示する
- `components/memo-composer.tsx` — 送信先がキューになる。オフライン（`navigator.onLine` が false）のときはタグ選択を隠し、送信時にタグを `tweet` に上書きする（選択中の state は変えない）。`navigator.onLine` が誤って true のときは、選んだタグのままキューに積む（積んだ時点のタグが送信される）

送信時の返事の扱い:

| 返事 | 扱い |
| --- | --- |
| 201 / 200 | キューから消す |
| 通信失敗、5xx、401 | 残して送信を中断し、あとでやり直す。401 はログイン後に再送 |
| 429 | 残して送信を中断し、あとでやり直す |
| 400、409、その他の 4xx | `failed` にして残す。「送信できません」と表示し、破棄ボタンで消せる。次のメモの送信は続ける |

認証:

- `apps/web/src/features/auth/stored-user-id.ts` — 新規。前回ログインしたユーザーの ID を、端末の `localStorage`（キー `memotion_user_id`）に保存・読み出し・消去する（既存の `config/theme.ts` と同じ流儀）。他の個人情報は持たない。この ID は UI を出す許可とキューの項目に付ける値であり、認可には使わない。認可は常にサーバーが行う。API の変更は不要（`/api/me` は `users.id` を返している）
- `apps/web/src/features/auth/api/get-me.ts` — `fetchMe` が、成功したら ID を保存し、401 なら消す（保存・消去はここ1か所）。`fetch` が例外になった場合とタイムアウト（5 秒）は、専用のエラー（通信失敗）として投げる。5xx は従来どおり汎用の例外を投げる。呼び出し側（`_app.tsx` と `login.tsx`）は、通信失敗だけを見分けられる
- `apps/web/src/routes/_app.tsx` — `beforeLoad` で、`fetchMe` が 401 なら `/login`。通信失敗（`fetch` の例外とタイムアウト）で、かつ前回のユーザー ID が端末にあるときだけ通す（タイムアウトは、電波が弱くて応答が来ないときに画面が進まなくなるのを防ぐ）。ID が無ければ `/login`。5xx と想定外の返事は通さない。`beforeLoad` が返す `{ user }` は、アプリのどこからも使われていないため返さない（オフラインで `user` が無くてもよい）。`fetchMe` が成功したあと、キューの中で `userId` が現在のユーザー ID と違う項目を破棄する（前回の ID との比較ではなく、項目の `userId` との比較。401 で ID が消えたあとに別のユーザーが入っても成り立つ）。`useQuery`（memos・notifications）のスケルトンも、待機中は固まらないようにする
- `apps/web/src/routes/login.tsx` — `beforeLoad` の `fetchMe` も、通信失敗（タイムアウトを含む）のときは例外にせず、ログイン画面をそのまま出す。5xx は従来どおり。ID が無い端末がオフラインで開いたときに、エラー画面にならないようにする
- ログアウト（`apps/web/src/routes/_app/settings.tsx` と `features/auth/api/logout.ts`）— 未送信のメモがあれば「未送信のメモが N 件あります。破棄してログアウトしますか」と確認する。OK なら、先にログアウト API を呼び、成功してからキューと端末のユーザー ID を破棄する。API が失敗したとき（オフラインを含む）は「ログアウトできませんでした」と表示し、キューもログイン状態も残す。セッション切れ（401）はログアウト操作ではなく、キューを破棄しない

PWA:

- `apps/web/vite.config.ts` と `apps/web/package.json` — `vite-plugin-pwa` を追加。`registerType: "autoUpdate"`、`skipWaiting` と `clientsClaim`。`manifest: false`（既存の `manifest.webmanifest` を使う）。`navigateFallbackDenylist: [/^\/api\//]`（LINE ログインの遷移を奪わない）。`globPatterns` はビルド成果物の js・css・html・woff2（`@fontsource-variable/inter`）・png・svg・webmanifest を含め、`autoCodeSplitting` の遅延チャンクを precache する。`/api/*` は一切キャッシュしない（NetworkOnly）
- `apps/web/tsconfig.app.json` — `vite-plugin-pwa/client` の型宣言を追加する（`pnpm build` の `tsc -b` を通すため）
- `apps/web/src/main.tsx` — Service Worker の登録は `virtual:pwa-register` の `registerSW` を使う（`autoUpdate` では、更新時にプラグインがリロードを行う。自前のリロードは足さない。初めてのインストールではリロードされない）。長く開いたままの PWA でも更新に気づけるよう、`visibilitychange` で表示に戻ったときに更新の確認（`registration.update()`）を呼ぶ。`vite-plugin-pwa` の自動リロードの挙動は、実装時に確かめる
- `apps/web/public/manifest.webmanifest` — 既存を維持（`start_url`・アイコンは設定済み）。`id` を足す。`start_url` は変えない

設定画面:

- `apps/web/src/features/notifications/components/settings-view.tsx` — `pwa-install-guide.tsx`（新規）を差し込む。`design.md` に従い、既存トークンだけで作る。バッジは既存の `tag-badge.tsx` の見た目に揃える

### 判断済みの論点

- 冪等キーは新規カラムを作らず、`memos.id` を流用する。マイグレーション不要で済み、`db.md` の前進のみの制約にも触れない
- Background Sync は iOS で使えないため採用しない
- `/api/*` は Service Worker でキャッシュしない。認証付きのレスポンスを端末に残さないため
- 別端末で削除したメモは、キューが再送すると復活しうる。影響が小さいため許容する
- 通知（TODO の日次、技術の週次）の対象は `createdAt` の窓で決まる。オフラインで書いたメモは、書いた時刻で保存されるため、通知を送ったあとに同期されたメモは、その通知には入らない。許容する（次の窓には入らない場合がある点も含めて、個人用のため影響が小さい）
- キューの項目にユーザー ID を持たせ、本人の分だけ送る。ユーザー ID は、オンラインで `/api/me` が成功したときに Web アプリが `localStorage` に保存したものを、オフラインでも読んで使う。別ユーザーのログインでは、他人の項目を送らず、表示もせず、破棄する
- 401（セッション切れ）で端末のユーザー ID を消しても、キューの各項目は自分の `userId` を持っているので、同じユーザーが再ログインして ID が保存し直されれば、そのまま送られる

### 論点の決定事項

1. **（決定）オフライン起動時の認証**: `fetchMe` が 401 なら従来どおり `/login`。通信自体の失敗で、前回のユーザー ID が端末にあるときだけ通す（5xx は通さない）。ID が無い端末（一度もログインしていない、またはログアウト済み、ブラウザが保存データを消した）は、ログイン画面のまま。セッション切れは同期時の 401 で分かり、キューを保持したままログインへ移り、ログイン後に再送する
2. **（決定）オフライン時の既存メモの表示**: 既存メモは端末に保存しない。注記と、送信待ちだけを出す。スケルトンは出さない。サイドバーの件数は「-」にする
3. **（決定）タグ**: オフラインのときだけ `tweet` 固定にし、入力欄のタグ選択を隠す。オンラインでは従来どおり選べる
4. **（決定）送信失敗（400・409・その他の 4xx）**: 「送信できません」と表示して残し、破棄ボタンで消せる。自動では破棄しない。429 はあとで再試行する。毎回 5xx やタイムアウトになって「送信待ち」から抜けないメモが後ろを止めないよう、「送信待ち」のメモにも破棄ボタンを出す（実装後のレビューで決定）
5. **（決定）更新時の入力中の文章**: 再読み込みで破棄してよい。入力中のリロード遅延や下書き保持は行わない
6. **（決定）ログアウト時の未送信メモ**: 確認したうえで、ログアウト API が成功してからキューを破棄する。API が失敗したら、キューもログイン状態も残す。オフラインではログアウトできない。セッション切れ（401）では破棄しない
7. **（決定）冪等のテスト**: 判定を純粋関数に切り出して単体テストする。`testing.md` は変えず、D1 は立てない。ルートの 200 / 409 は、ブラウザ（`wrangler dev --local`）で手動確認する
8. **（決定）作成時刻**: 端末でメモを書いた時刻（`createdAt`）を送り、サーバーが保存する。現在時刻より 5 分を超えて未来なら、現在時刻にする
9. **（決定）キューに保存できないとき**: オンラインなら従来どおり直接送る。オフラインなら、オフラインでの追加が使えない旨を表示する

## 4. テスト影響範囲

- `apps/api/src/features/memos/index.test.ts` — 「drops client-supplied fields」（`createMemoRequestSchema.parse` の結果が `{ tag, content }` と厳密一致する）は、入力に `id` や `createdAt` が無ければ期待値は変わらない。`id` と `createdAt` を許す前提のケースを足し、`id` 以外の未知フィールド（`userId` など）は引き続き落ちることを維持する。`id` なしの既存ケースは変わらない
- `apps/api/src/features/memos/repository.test.ts` — 変更なし（id で引く関数は薄い整形のため、単体テストの対象にしない）
- `packages/shared` にはテストファイルが無いため、契約のテストは既存の流儀どおり `index.test.ts` に置く
- それ以外の既存テストへの影響はない。`id` を省略した従来のリクエストは同じ動作

## 5. 新規テストケース

単体（Vitest。API のみ。Web にはテスト基盤が無い）。壊れるとメモが失われる・漏れる箇所だけに絞る:

`idempotency.test.ts`（`decideCreateResult` の既存行の判定。入力の行の型は `ExistingMemoRow` で縛る）:

- 既存が同じユーザーで、本文もタグも同じ → 自分の既存（200）
- 既存が同じユーザーで、本文だけ違う → 衝突（409）
- 既存が同じユーザーで、タグだけ違う → 衝突（409）
- 既存が別のユーザーで、本文もタグも同じ → 衝突（409）。内容が同じでも 200 にしない
- 衝突の戻り値に、既存メモの本文・タグが含まれない

`idempotency.test.ts`（保存結果から service の結果を決める）:

- 保存成功 → 作成（201）
- 主キー重複で、既存が自分の行・同じ内容 → 既存（200）。作成扱いにしない（OGP を走らせない根拠）
- 主キー重複で、既存が別ユーザー、または内容が違う → 衝突（409）
- 主キー重複で、既存の行が引けない（削除との競合など）→ `save_failed`
- 主キー重複以外のエラー（`line_message_id` など他の一意制約違反を含む）→ `save_failed`。衝突にしない

`idempotency.test.ts`（主キー重複の判定 `isPrimaryKeyConflict`）:

- `cause` に `UNIQUE constraint failed: memos.id` を持つエラー（`DrizzleQueryError` と同じ形: `message` は `Failed query: ...`）→ 主キー重複
- `cause` に `UNIQUE constraint failed: memos.line_message_id` を持つエラー → 主キー重複ではない

`resolve-created-at.test.ts`（保存時刻の決定。`now` は引数）:

- `createdAt` なし → 現在時刻
- 過去の `createdAt` → そのまま使う
- UTC 以外のオフセット付きの `createdAt`（例: `+09:00`）→ UTC の `toISOString()` の形に正規化される
- 現在時刻より、ちょうど 5 分の未来 → そのまま使う。5 分を超える未来 → 現在時刻

契約（`index.test.ts` の `createMemoRequestSchema`）:

- `id` なし → 受理（従来どおり）
- UUID v4 の `id` → 受理
- ISO 8601 の `createdAt` → 受理
- バージョンが v4 以外（v1 など）→ 拒否
- 不正な文字列 → 拒否
- `id` 以外の未知フィールド（`userId` など）→ 従来どおり落ちる

ルート（`index.test.ts`。`testing.md` に沿い 401 と 400 まで）:

- 有効な `id` 付きでも、未認証 → 401（認証が先）

削ったもの（理由）: repository の整形（実装の写しになる）、`id` の細かい境界（null・数値・1 文字違い。形式の検証は Zod が担う）、大文字の UUID（端末は小文字しか作らず実害がない）、本文が空のケース（既存のテストで守られている）、不正な `id` の 400（契約のテストと重複）。既存行が引けない場合は、`save_failed` にするだけ（極めてまれ）

Web の確認（ブラウザで手動。AGENTS.md の方針）。再現手順は括弧に書く:

オフライン追加と表示:

- DevTools でオフラインにしてメモを追加 → 先頭に「送信待ち」が出る
- オフラインでコンポーザーを開く → タグ選択が出ず、tweet で積まれる
- オンライン表示でタグを選んで積む（`navigator.onLine` が true）→ 選んだタグのまま送信される
- オフラインで一覧を開く → スケルトンが出ず、注記と送信待ちだけが出る。サイドバーの件数が固まらず、「-」になる
- 送信待ちがタグのフィルタと検索に掛かる。送信待ちは選択・一括削除の対象にならない
- 再読み込み・タブを閉じて再度開いても、キューが残っている

送信:

- オンラインに戻す → 自動で送信され、バッジが消え、重複しない
- 起動時、`online`、フォーカス復帰（別アプリから戻る）の各トリガーで、それぞれ送信される
- 同じ `id` で再送（DevTools の Request blocking で応答だけ落とす）→ 200 で、メモが重複しない。OGP が再実行されない
- 送信中にオフラインにして再送 → 重複しない。送信中にリロード → 重複しない
- 複数タブで同時に開く → 重複しない
- オンラインのまま 5xx が続く（DevTools のローカルオーバーライドで再現）→ 「送信待ち」のまま残り、別アプリから戻る（フォーカス復帰）と、直っていれば送られる
- 応答が返ってこない送信（Request blocking で止める）→ 10 秒で打ち切られ、ほかのタブの送信を止めない
- 通信失敗・5xx・401・429（DevTools のローカルオーバーライドで再現）→ キューが残り、後ろのメモを送らずに中断し、あとで古い順に送られる
- 400（IndexedDB の `content` を空に書き換えて再現）、409（別ユーザーの `id` を手で入れて再現）、403 / 404 など → 「送信できません」が出て、破棄ボタンで消える。後ろのメモは送られる。409 では他人のメモの内容が見えない

認証:

- 前回ログインした端末でオフライン起動 → メモ画面が出る。一度もログインしていない端末は、ログイン画面のまま
- 書いた時刻が保存される: 朝にオフラインで書いたメモが、同期した夜に、朝の時刻で一覧に並ぶ
- ログインしていない端末でオフライン起動 → ログイン画面が出る（エラー画面にならない）
- 電波が弱く、応答が来ない状態で起動（DevTools の Slow 3G など）→ 5 秒で打ち切られ、画面が進む
- IndexedDB が使えない状態（プライベートブラウズなど）→ オンラインなら直接送られる。オフラインなら、使えない旨が出る
- オフラインでログアウト → 「ログアウトできませんでした」と出て、キューもログイン状態も残る
- 送信が成功したあと → 一覧に、サーバー側のメモが現れる（`["memos"]` が更新される）
- ログアウト後にオフライン起動 → ログイン画面になる（端末のユーザー ID が消えている）
- オンラインで開いたあとにオフラインで開く → 保存されたユーザー ID でメモ画面が出て、積んだメモの `userId` が一致する
- `/api/me` が 5xx のとき → 前回ログイン済みでも通さない
- 401 のとき → キューが残り、ログイン後に送られる。端末のユーザー ID は消え、再ログインで保存し直される
- 未送信があるときにログアウト → 確認が出て、OK でキューが消える。キャンセルなら残る。401（期限切れ）のときは破棄されない
- 別ユーザーでログイン → 前のユーザーの未送信が送られず、表示されず、端末に残っていない

PWA:

- 新版をデプロイして開く → 自動で新版になり、遅延チャンクの読み込みが失敗しない。オフラインでも `_app`・`login` が開く
- Service Worker が有効な状態で、LINE ログインの往復ができる
- `/api/*` のレスポンスが Service Worker にキャッシュされない
- `/sw.js` の `Content-Type` が JavaScript で、`index.html` に置き換わっていない。`Cache-Control` を確認する
- `manifest.webmanifest` に `id` があり、`start_url` が変わっていない
- iPhone 実機: ホーム画面に追加した PWA から LINE ログインが完了し、セッションが有効になる（Safari と Cookie が別になる問題がないか）
- 設定画面で、iPhone・Mac(Safari)・Mac(Chrome) の 3 種の手順が並び、開閉できる。オフライン時の動作の説明がある。iPhone 実機でホーム画面追加を確認

## 6. 実装順

1. `packages/shared` の契約変更（`id`（任意の UUID v4）と `createdAt` を追加）。小さいので本体（上位モデル）で行う
2. API: `idempotency.ts`（`isPrimaryKeyConflict` と `decideCreateResult`）と `resolve-created-at.ts` の失敗するテスト → 最小実装 → `createForUser` の冪等化 → `index.ts` のレスポンスコード。冪等と他ユーザー衝突の扱いは中核なので上位モデルで実装する
3. Web: `features/auth/` のユーザー ID の保存・読み出し・消去、`outbox.ts`、`create-memo.ts`（戻り値の型）、`flush.ts`（IndexedDB の薄いラッパーと送信ループ。返事ごとの扱いの表どおり）。排他・中断条件が絡むため上位モデルで実装する。`outbox.ts` が `features/auth/` のユーザー ID に依存するため、ID の保存・読み出しを先に作る
4. PWA とオフライン起動: `vite-plugin-pwa`、Service Worker、更新時のリロード、`_app.tsx` と `login.tsx` のオフライン起動（タイムアウトを含む）。上位モデルで実装する。`vite-plugin-pwa` の設定の調査は安価なモデルのサブエージェントに委任してよい。これを先に済ませ、次の UI を実際のオフライン起動で確認できるようにする
5. Web: `merge-pending.ts`、一覧のマージ表示とオフライン時の注記、「送信待ち」「送信できません」バッジ、`use-outbox.ts`、`use-outbox-sync.ts`、コンポーザーのオフライン時タグ非表示、ログアウト時の確認。UI の定型作業は安価なモデルのサブエージェントに委任してよい（`design.md` に従う）
6. 設定画面の導入手順（`pwa-install-guide.tsx`）。文言とアコーディオンの定型作業のため、安価なモデルのサブエージェントに委任してよい
7. ブラウザで通し確認 → iPhone 実機で確認（人間）
8. 観点別レビュー（design-reviewer・edge-case-reviewer・security-reviewer）を並列で走らせ、P0/P1 を修正

## 7. コミット前テスト実行

```bash
pnpm lint
pnpm typecheck
pnpm --filter @repo/api test
pnpm build
```

## 8. スコープ外

- オフラインでの削除・編集・画像の追加
- プッシュ通知
- Background Sync（iOS 非対応）
- 複数端末間のリアルタイム同期
- 実装後レビュー 3 回目の裁定で見送ったもの: 送信中に破棄したメモが、すでに始まった送信で保存されうること。メモ本文の文字数に上限がなく、毎回サーバーで失敗するメモが後ろの送信を止めうること（破棄ボタンで抜けられる）
- Web の純粋関数（`merge-pending.ts`、`create-memo.ts` の返事の分類）の自動テスト。Web にテスト基盤を足すときの優先候補として残す
- アプリアイコンやスプラッシュ画面の見直し
