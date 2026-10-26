# プラン: 予定（schedule）タグとカレンダー

状態: ドラフト（step 2、3 のレビュー指摘を反映済み）｜元資料: なし（チャットでの要件の合意）｜issue: 未定

## 1. 概要

メモに「予定」（タグ `schedule`）を足す。予定は日付（必須）と時刻（任意）を持つ。予定の前日の 20:00（JST、設定画面で変更可）に、翌日の予定を LINE に1通でまとめて送る。サイドバーに「カレンダー」を足し、予定がある日を月表示で見せ、日を選ぶとその日の予定の一覧を出す。

## 2. 背景

今のメモが持つ日時は、書いた時刻（`createdAt`）だけで、「いつの予定か」を残せない。予定を忘れないよう、前日に LINE で知らせたい。カレンダーは、まず予定がある日をひと目で見せるために作り、あとから日ごとのメモと日報（今後実装予定）を見られる画面に育てる。

## 3. 詳細設計

### 合意済みの仕様

予定:

- タグ `schedule`（表示名「予定」）を足す。予定は、日付（`YYYY-MM-DD`、必須）と時刻（`HH:MM`、なしも可）を持つ。日本時間（JST）で固定する。終了時刻と繰り返しは持たない
- 本文（何の予定か）は他のメモと同じく必須で、前後の空白を除いて1文字以上。日時だけで本文が空の予定は作れない
- 日付が今日（JST）より前の予定は、登録も日時の変更もできない。今日の日付は登録できる（時刻は見ない）。すでに登録した予定は、日付が過ぎても残る
- LINE からは登録しない。`#schedule` は今まで通り受け付けず（`unknown_tag`）、LINE のコードは変えない。LINE から送ったメモは `tweet` で保存される
- グループに入れられない（「やること」と同じ扱い）

登録の入口:

1. Web の入力欄（メモの追加）でタグ「予定」を選ぶ。日付（必須）と時刻（任意）の欄が出る。オフラインでは選べない（今の入力欄は、オフラインでは分類を選べず、つぶやきで積む）
2. メモタブで、つぶやきのメモを「予定にする」。日付と時刻を入力するダイアログが出る

- 予定から他のタグへ戻す操作と、他のタグ同士の切り替えは作らない
- 予定の日時の変更は、メモカードと、カレンダーの日の一覧のどちらからでもできる。「予定にする」と「日時を変更」は同じダイアログと同じ API を使う
- 削除は、メモタブの削除（今のまま）と、カレンダーの日の一覧の「削除」。どちらも確認ダイアログを出し、`POST /api/memos/bulk-delete` を使う

表示:

- メモタブにも残す。予定のカードに「予定」のバッジと日時（時刻がなければ「時間未定」）を出し、タグの絞り込みに「予定」を足す
- サイドバーに「カレンダー」を足す（`/calendar`）。月表示で、予定がある日に点を1つ付ける（件数に関わらず1つ）。週は日曜始まり。今日を強調し、前月・次月に移動できる。今日を選んだ状態で開く
- 日を選ぶと、その日の予定の一覧を出す。時刻のない予定を先頭に置き、残りは時刻の早い順に並べる。一覧の各予定に、日時の変更と削除を置く。日ごとのメモと日報は、あとで足せる作りにする（今は出さない）
- カレンダーは、今のメモ一覧の取得（`GET /api/memos`。グループに入っていないメモ）から予定のメモを選んで表示する。新しい取得 API は作らない。予定はグループに入れられないので、取りこぼしは起きない
- カレンダーの月と選んだ日は、画面の状態（`useState`）で持つ。URL には出さない。再読み込みすると、今日を選んだ状態に戻る

通知:

- 前日の設定時刻（初期値 20:00、JST）に、翌日の予定を1通にまとめて LINE に送る。翌日に予定が無い日は送らない
- 設定は「やること」の毎日通知と同じ形（オン/オフと時刻）で、設定画面に足す。初期値はオンの 20:00。設定画面には、次の通知に含まれる件数は出さない（「やること」と違い、件数の計算が複雑になるため）
- LINE に送れない状態（`unreachable`）になったら、既存の通知と同じく自動でオフにして理由を残す
- 既存のユーザーも、設定の行が無いあいだは初期値（オン、20:00）で扱われる。デプロイ後に予定を登録した最初の夜から、何も操作しなくても通知が届く（意図した仕様）。設定画面のヒントに、オフにできることを書く
- 文面は次の形。長くなったときの扱い（5000 文字、5 通まで、あふれた分は「他N件は Web で」）は、既存の通知と同じ:

```
明日の予定 3件（11/3）
時間未定 引っ越しの手続き
10:00 ミーティング
14:00 歯医者
```

- 予定の本文は 200 文字までに切る（既存と同じ）
- 今日の日付の予定と、通知の時刻を過ぎてから登録した予定には、通知が届かない（その前日の通知はもう済んでいるため）
- 登録するとき、通知が届かない日付を選ぶと、その場で「この予定は LINE に通知されません」と知らせる（詳細は「判断済みの論点」）
- 設定をオンにしたときと、時刻を変えたときは、すぐには送らない（既存の通知と同じ）。そのとき、通知の時刻がすでに今日に来ていれば、その分は処理済みになる。たとえば 19:00 に時刻を 20:00 から 08:00 に変えると、翌日の予定の通知は届かず、次の通知は翌日分から始まる。設定画面のヒントに書く
- 「技術の週次」と「やることの毎日」の通知は変えない

### 判断済みの論点（実装時に迷わないための決め）

- 「明日」は、通知の時刻（`latestDailyDueAt`）の JST の日付の翌日とする。実行した時刻の翌日ではない。この日付を「対象日」と呼ぶ
- 通知を送るのは、実行した時刻の JST の日付が、通知の時刻の JST の日付と同じあいだだけにする（日付をまたいだら「明日の予定」が嘘になるため）。例: 20:00 の通知が 00:10 に遅れて動いても送らない。設定の行が無い初回も、同じ日のうちなら送り、前日の古い通知は送らない。日付をまたいで捨てるときは、その対象日を処理済みにして、1回だけ `skipped`（`reason: stale`）をログに出す（そのとき対象日の予定の件数も出す。取りこぼしか、設定かを区別できるように）。ただし、一度も処理していない行（`last_target_date` が `null`）は、取りこぼしではないので、何もせず（ログも出さず）、通知の時刻が来るのを待つ
- **二重送信は、対象日ごとに1回だけに制限する。** `schedule_daily_settings` に `last_target_date`（最後に処理した対象日）を持たせる（`last_sent_at` は持たない）。送る前に、次の1文で「先取り」する。行が無いときは、既定値の行を作る
  `INSERT ... ON CONFLICT(user_id) DO UPDATE SET last_target_date = :対象日 WHERE last_target_date IS NULL OR last_target_date < :対象日`
  - 更新された行が0なら、すでに処理済み（別の実行が取った）として何もしない
  - 先取りは、予定の取得と LINE への送信より前に行う。送信後の書き込みの失敗、前の分の実行との重なり、cron の重複起動で、同じ予定が2回届かない
  - 先取りしたあと、予定が0件なら、そのまま終わる（処理済みのまま）。通知の時刻を過ぎてから登録した予定が、その日の遅い時刻に通知されることもない
  - 一時的な送信失敗（`transient`）のときは、先取りを元に戻して（`UPDATE ... SET last_target_date = :先取り前の値 WHERE user_id = :id AND last_target_date = :対象日`）、次の分に再試行する。元に戻す書き込みが失敗したら、その日の分は送らない（二重送信より取りこぼしを選ぶ）。`failed` をログに出す
  - `unreachable` のときは、設定をオフにする（先取りは戻さない）
  - 判断（無効か、時刻を過ぎたか、日付をまたいだか）は設定の行だけで決め、送ると決まったあとにだけ、先取りと予定の取得を行う（毎分、ユーザーごとに予定のクエリを走らせない）
- 設定の更新（`PATCH /api/notifications`）は、予定の通知の設定では `enabled`・`time`・`disabled_reason` の列だけを書き、`last_target_date` には触らない。また、変更のあった表だけを書く（今は、技術・やること・予定の3つを読んだ値で全部書き戻しているため、cron が先取りした値を古い値で巻き戻しうる）
- オンにしたときと時刻を変えたときの「すぐには送らない」は、通知の時刻がすでに今日に来ていて、同じ日のうちなら、その対象日を同じ先取りの1文で処理済みにすることで実現する。通知の時刻が今日まだ来ていなければ、何もしない（時刻が来たら送る）
- 送るかの判断は、次の順に調べる（設定が 20:00 の例）。`due` は「`now` から見て直近の過去の通知の時刻」、対象日は `due` の JST の日付の翌日
  1. 無効 → 送らない（`disabled`）
  2. `last_target_date` が対象日以降 → 送らない（`already`）
  3. `now` の JST の日付が `due` の日付と違う → `last_target_date` が `null` なら送らない（`not_due`）。`null` でなければ送らず、処理済みにする対象日を返す（`stale`）
  4. それ以外 → 送る（対象日つき）
  - 例: 11/2 19:59:59 で `last_target_date` が `2026-11-02` → `already`。`2026-11-01` → `stale`（処理済みにする対象日は `2026-11-02`）。`null` → `not_due`。11/2 20:00:00 で `2026-11-02` → 送る（対象日 `2026-11-03`）。`2026-11-03` 以降 → `already`。11/3 00:10 で `2026-11-02` → `stale`（対象日 `2026-11-03`）
  - `stale` で処理済みにしたあと、次の分は `already` になる（毎分ログが出ない）
- 送信結果からの後始末は、純粋関数 `afterSchedulePush(result, previousLastTargetDate)` に切り出す。`success` はそのまま。`transient` は、先取りを元に戻す値（先取り前の `last_target_date`）を返す。`unreachable` は、設定をオフにする指示を返し、元には戻さない
- `scheduled` が3つの通知を独立に実行する処理は、実行する関数を引数で受け取る小さな関数 `runIndependently(tasks)`（`notifications/run-independently.ts`）にする。1つが例外を投げても、残りを実行し、失敗を数える
- 登録と日時の変更の検査は、純粋関数に切り出し、DB に触る前に過去の日付を弾く。順番は「過去の日付（DB に触らない）→ メモの取得（持ち主で絞る）→ 状態の判断」。状態の判断は `decideScheduleSet({ memo: { tag, groupId } | null })`（`null` なら `not_found`。タグが `tweet` か `schedule` でグループなしなら `ok`。それ以外は `not_schedulable`）。作成の検査は `validateCreateSchedule({ tag, groupId, scheduledDate }, now)`（`schedule` と `groupId` の同時指定は `invalid`。`schedule` で過去の日付は `past_date`）。過去の日付が先に返るので、他人のメモでも 404 でなく 400 になるが、メモの存在は漏れない
- 同じ時刻の予定の並びは、登録順（`createdAt` の古い順）にする。通知の文面とカレンダーの一覧で同じにする
- `listSchedulesOnDateForUser` は、`memos.user_id = userId AND scheduled_date = date AND tag = schedule` で絞る（`group_id` は見ない）。戻り値は `{ scheduledTime, content, mediaType, url, createdAt }[]`。通知の送信先は、ループ中の同じユーザーの `lineUserId` を使う
- 予定の本文が URL だけの場合は、他のメモと同じく URL のメモとして扱う（OGP も取る）。通知の1行は、既存の `formatMemoLine` と同じく URL を表示し、1通あたりのプレビューの上限（5件）に数える。本文の 200 文字の切り詰めは、URL でないときだけ
- JST の日付を求める小さな関数は、`memos` と `notifications` にそれぞれ置く（`.agents/rules/architecture.md` の「まず各機能に置く」に従う）
- 予定の登録と日時の変更で、通知が届かない日付を選んだら、日付の欄の下に「この予定は LINE に通知されません（通知は前日の HH:MM に届きます）」と出す（入力欄と日時ダイアログの両方）。通知が届かないのは、日付が今日のとき、または日付が明日で、前日の通知の時刻（設定画面の `scheduleDailyTime`）をすでに過ぎているとき。判断は Web が、取得済みの通知の設定（`["notifications"]`）と JST の今の時刻から行う。通知の設定がオフのとき、または設定を読み込めていないとき（オフラインを含む）は、この注意を出さない（登録は妨げない）

### 機能境界

- `memos` テーブル（予定の日時の列を含む）は `memos` の機能が持つ。予定の登録・日時の変更・予定の取得は、`memos` の service に置く
- 依存は `notifications` → `memos` の一方向にする。通知の service が、`memos` の service の `listSchedulesOnDateForUser` を呼ぶ（既存の技術・やることの取得が `memos` のテーブルを直接引いているのは、そのままにする）
- 予定の日次通知の設定テーブル `schedule_daily_settings` は `notifications` の機能が持つ。通知の service は、先取りの1文と、設定の読み書きだけを自分の repository に置く

### 認可

- 新しい `PUT /api/memos/:id/schedule` は、先頭で `readSessionUserId` を呼び、無ければ 401 を返す
- 検査の順番は「セッション（401）→ `:id` と本文の検査（400）→ 過去の日付（400）→ 持ち主と状態の確認（404 / 409）」。ルートは最初の2つだけを行い、あとの2つは service が結果を返して、ルートはその対応表だけにする（`.agents/rules/architecture.md`。ルートに業務ロジックと時刻の取得を置かない）
- 他人のメモと存在しないメモは、区別せず 404（`{ message: "not found" }`）にする。更新の SQL も `memos.user_id` で絞る
- 更新は、メモの状態の確認と同じ条件（自分のメモ、グループなし、タグが `tweet` か `schedule`）を `WHERE` に入れた1文で行う。確認と更新のあいだに、別の処理が「グループに追加」しても、グループに入った予定は作れない（0 行更新のときは、`user_id` 付きでもう一度引き、メモが無ければ 404、あれば 409。更新の間にメモが削除されたときに 409 を返さないため）
- `createForUser` は、先頭で `groupId` と `schedule` の同時指定を `invalid` で弾く（入口の Zod だけに頼らず、グループに入った予定を service でも作らせない）
- 「グループに追加」の SQL は、対象から `schedule` を外す。両方の SQL が、相手の条件（タグ、`group_id`）を `WHERE` に持つため、同時に動いても、グループに入った予定は生まれない

### 変更するファイル（見込み）

契約（先に直す）:

- `packages/shared/src/schedule.ts` — 新規。`scheduleDateSchema`（`YYYY-MM-DD`、実在する日付）、`scheduleTimeSchema`（`HH:MM`）、`setScheduleRequestSchema`（`scheduledDate`、`scheduledTime` は省略か null で「時間未定」）
- `packages/shared/src/memo.ts`
  - `memoTagSchema` に `schedule` を足す
  - `memoSchema` に `scheduledDate?` と `scheduledTime?`（予定のときだけ入る）を足す
  - `createMemoRequestSchema` に `scheduledDate?` と `scheduledTime?` を足す。タグが `schedule` のときは `scheduledDate` が必須。ほかのタグに日時が付いたら不可。日付なしの時刻は不可。Zod の `.extend()` は、検査（`superRefine`）を持つスキーマには使えないので、検査を外した土台のスキーマを作り、その上に検査を足す
- `packages/shared/src/group.ts`
  - `groupMemoTagSchema` から `schedule` も除く
  - `createGroupMemoRequestSchema` は土台のスキーマから `scheduledDate` と `scheduledTime` を除いて作る（グループの入力欄が日時を受け取らないように）
  - `assignMemosResponseSchema` に `skippedSchedule` を足す
- `packages/shared/src/error.ts` — `apiErrorCodeSchema` に `schedule_date_past`（過去の日付）と `not_schedulable`（予定にできないメモ）を足す
- `packages/shared/src/notification.ts` — `notificationSettingsSchema` に `scheduleDailyEnabled`、`scheduleDailyTime`、`scheduleDisabledReason` を足す。更新の要求にも `scheduleDailyEnabled` と `scheduleDailyTime` を足す
- `packages/shared/src/index.ts` — 上記を書き出す

API（`memos`）:

| ルート | 内容 |
| --- | --- |
| `PUT /api/memos/:id/schedule` | つぶやきを予定にする、または予定の日時を変える。本文は `setScheduleRequestSchema`。成功したら更新後のメモを返す |
| `POST /api/memos` | 変更。`scheduledDate` と `scheduledTime` を受け取る（タグが `schedule` のとき） |

- `PUT /api/memos/:id/schedule` のエラー（service が返す）: 日付が今日より前なら 400（`code: "schedule_date_past"`）。タグが `tweet` と `schedule` 以外、またはグループに入っているメモなら 409（`code: "not_schedulable"`）。他人のメモと存在しないメモは 404
- `POST /api/memos` でタグが `schedule` のとき、日付が今日より前なら 400（`code: "schedule_date_past"`）。`createForUser` の戻り値に `past_date` を足し、`groups` の `createMemoForUser` の経路も同じ戻り値を通す
- `apps/api/src/features/memos/schedule.ts` — 新規。純粋関数。`isPastScheduleDate(date, now)`（JST の今日より前か）、`decideScheduleSet({ memo })`、`validateCreateSchedule(input, now)`（判断済みの論点を参照）
- `apps/api/src/features/memos/service.ts` — `createForUser` が、先頭（`findTagBySlug` より前、DB に触る前）で `validateCreateSchedule` を呼び、日時を保存し、過去の日付を `past_date` で返す。`setScheduleForUser` を新設（先頭で `isPastScheduleDate` を呼び、そのあとメモを取得して `decideScheduleSet` で判断し、更新する。D1 の例外は投げ直さず、`memo.schedule` のログに ID だけを出して `save_failed` を返す。例外の message には日付や本文が入るため）。`listSchedulesOnDateForUser(db, userId, date)` を新設（通知用）。`assignGroupForUser` が `schedule` を除き、`skippedSchedule` を返す。`toMemoResponse` が日時を出す（予定のときだけ。時刻が null なら時刻のキーを出さない）
- `apps/api/src/features/memos/repository.ts` — `MemoRow` に `scheduledDate` と `scheduledTime` を足す。一覧・取得・挿入で扱う。予定の更新の SQL と、ある日の予定の取得を足す。`assignMemosToGroup` の対象から `schedule` を除き、除いた件数を数える
- `apps/api/src/features/memos/idempotency.ts` — 同じ id の再送の判定で、タグが `schedule` のときは日付と時刻の一致も比べる（違えば 409）。比較は、自分の行かどうかの条件（`existing.userId === userId`）と同じ AND の内側に置く（他人の行の日時の違いで、結果が変わらないように）
- `apps/api/src/features/memos/index.ts` — `PUT /api/memos/:id/schedule` を足す（401、`:id` と本文の検査、service の結果の対応表だけ）
- `apps/api/src/features/groups/index.ts` と `service.ts` — 「グループに追加」の応答に `skippedSchedule` を通す

API（`notifications`）:

- `apps/api/src/features/notifications/window.ts` — `scheduleTargetDate(now, slot)`（通知の時刻の JST の日付の翌日）、日付をまたいでいないかの判定、設定を変えたときに処理済みにする対象日（`scheduleTargetToMark(now, slot)`。通知の時刻がまだ今日に来ていなければ `null`）を足す。純粋関数
- `apps/api/src/features/notifications/schedule-digest.ts` — 新規。予定の日次通知を送るかの判断。入力は設定と `now` だけ（予定は渡さない）。結果は「送る（対象日つき）」か、「送らない」（`disabled` / `already` / `not_due` / `stale`（処理済みにする対象日つき））で、判断の順番は「判断済みの論点」のとおり。送信結果からの後始末（`afterSchedulePush`）もここに置く。純粋関数
- `apps/api/src/features/notifications/message.ts` — `buildScheduleDigestMessages` を足す。既存の詰め込み処理（`packDigestMessages`）は、並べ替えと1行の整形を呼び出し側から渡せる形に直す。技術・やることの出力は変えない
- `apps/api/src/features/notifications/settings.ts` — 予定の設定は、別の型 `StoredScheduleSettings`（`enabled`、`time`、`lastTargetDate`、`disabledReason`）にする。`StoredNotificationSettings`（技術・やること）と `applySettingsPatch` は変えない（既存のテストの `toEqual` が壊れないように）。`DEFAULT_SCHEDULE_DAILY`（オン、20:00、`lastTargetDate: null`）。`toNotificationSettings` に、予定の設定を渡す引数を足す（`lastTargetDate` は応答に出さない）。`planScheduleSettingsChange(current, patch, now)` を新設（更新後の `enabled`・`time`・`disabledReason` と、処理済みにする対象日 `markTarget` を返す。`markTarget` は、更新後がオンで、オンにしたか時刻を変えたときだけ。オフのまま時刻だけ変えたときは `null`。純粋関数）。`changedSections(patch)`（技術・やること・予定のどれを書くか。純粋関数）を新設
- `apps/api/src/features/notifications/repository.ts` — `schedule_daily_settings` の読み取りと、`enabled`・`time`・`disabled_reason` だけを書く更新（`last_target_date` には触らない）と、先取りの1文（と、元に戻す1文）を足す
- `apps/api/src/features/notifications/run-independently.ts` — 新規。`runIndependently(tasks)`（判断済みの論点を参照）
- `apps/api/src/features/notifications/service.ts` と `scheduled.ts` — `runScheduleDailyDigest` を足し、`scheduled` から呼ぶ。失敗はユーザー1人で止めず、`failed` を数えて次へ進む。`updateNotificationSettings` は、`changedSections` が示した表だけを書く。`scheduled` は、技術・やること・予定の3つを `runIndependently` で実行する（`listAllowedUsers` が失敗しても、他の通知が止まらない）
- 設定の行がまだ無いユーザーにも通知が届くよう、行が無いときは `DEFAULT_SCHEDULE_DAILY` で扱う（既存と同じ）
- `.agents/rules/line-security.md` — `PUT /api/memos/:id/schedule` の認可の行を足す。`.agents/rules/logging.md` — 標準キーの `event` に `schedule.daily` と `memo.schedule` を足す。`.agents/rules/db.md` — 「設定」の節に `schedule_daily_settings` と `DEFAULT_SCHEDULE_DAILY` を足す

DB:

- `apps/api/src/db/schema.ts`
  - `memos` に `scheduled_date`（text、NULL 可）と `scheduled_time`（text、NULL 可）を足す。`(user_id, scheduled_date)` の索引を足す
  - `schedule_daily_settings` を足す（`id`, `user_id`（`users.id` を参照、`onDelete: restrict`、一意）, `enabled`, `time`, `last_target_date`（text、NULL 可）, `disabled_reason`）。`todo_daily_settings` に近い形だが、`last_sent_at` の代わりに `last_target_date` を持つ
- マイグレーション（前進のみ。`.agents/rules/db.md`）: `pnpm --filter @repo/api db:generate` で生成し、生成された SQL を確認してから適用する。`CREATE TABLE`、`ALTER TABLE memos ADD`（2回）、`CREATE INDEX` だけで、`memos` を作り直していないこと。あわせて、タグの行 `('tag_schedule', 'schedule', 'Schedule')` を、`0002` が `tag_todo` を足したのと同じ形で、適用前の SQL に追記する。`db:migrate:remote` の前に、人が本番の `tags` に `schedule` の行が無いことを、読み取りで確かめる（重複で途中失敗しないように）

Web:

- `apps/web/src/config/tag-meta.ts` — `schedule` を足す（表示名「予定」、既存の色トークン `midnight-ink` の淡い塗り（`bg-midnight-ink/15`）を第一候補にする。`signal-blue` は技術の `sky-wash` と見分けにくいため使わない。既存の4タグと見分けられるかを、ブラウザで確認して決める）。`TAG_ORDER` は「つぶやき・技術・やること・予定・その他」の順
- `apps/web/src/features/memos/components/memo-composer.tsx` — タグ「予定」を選ぶと日付と時刻の欄を出す。日付は今日（JST）より前を選べない。送信するとき、タグが「予定」でオフラインなら、送らずに入力を残し、「オフラインのため予定は登録できません」と出す（今の入力欄は、オフラインだとタグを黙って「つぶやき」に置き換えるため、日付を捨てたつぶやきが積まれてしまう）。入力欄の表示中にオフラインになったら、予定の選択を外し、日付の欄を無効にする。通知が届かない日付のときの注意を出す
- `apps/web/src/features/memos/components/memo-list.tsx` — タグが「予定」の送信は、未送信リストを通さず、直接送る既存の経路（`createMutation`）を使う（未送信リストは日時を持たないため。未送信リストは変えない）。失敗したら入力欄を閉じず、本文と日時を残して「保存できませんでした。」を出す。件数の集計に `schedule` を足す
- `apps/web/src/features/memos/offline/outbox.ts` — `OutboxItem.tag` の型を `schedule` を除いたものにする（日時なしの予定を未送信リストに積めないように）
- `apps/web/src/features/memos/components/memo-card.tsx` — 予定のバッジと日時を出す。つぶやきのカードに「予定にする」、予定のカードに「日時を変更」を置く。どちらもオフラインでは使えない
- `apps/web/src/features/schedule/` — 新規
  - `api/set-schedule.ts` — `PUT /api/memos/:id/schedule`。エラー本文は `apiErrorSchema` で読む
  - `components/schedule-dialog.tsx` — 日付（必須）と時刻（任意）のダイアログ。「予定にする」と「日時を変更」で共用。既存の `AlertDialog` を使う（`GroupNameDialog` と同じ。新しい部品は作らない）。日付の初期値は、元の予定の日付が今日以降ならその日付、過去なら今日。「予定にする」のダイアログには、「予定からつぶやきには戻せません」と書く。過去の日付はエラーを出す
  - `components/calendar-view.tsx`、`month-grid.tsx`、`day-schedule-list.tsx` — 月のカレンダーと、日の一覧（日時の変更と削除）。メモ一覧と同じく、読み込み中（スケルトン）、取得失敗、オフライン（データが無いまま取得が止まっているとき。「オフラインのため予定は表示できません」）の表示を出す（出さないと、点が1つも無い月が「予定が無い」と区別できない）。「日時を変更」はオフラインで使えない。「今日」は、予定の登録と同じく JST で決める
  - `month-grid.ts`、`day-schedule.ts` — 月の格子と、日ごとのまとめと並べ替え（時刻のない予定が先頭、残りは時刻の早い順、同じ時刻は登録順。Web だけの純粋関数）
  - `schedule-notice.ts` — 新規。`willBeNotified(date, now, dailyTime)`（その日付の予定に通知が届くか。JST）。入力欄と日時ダイアログが、日付の欄の下の注意を出すかの判断に使う（Web だけの純粋関数）
- `apps/web/src/routes/_app/calendar.tsx` — 新規（`/calendar`）。`routeTree.gen.ts` は生成で更新される（手で編集しない）
- `apps/web/src/components/layout/sidebar.tsx` — `NAV_ITEMS` に「カレンダー」を足す。`apps/web/src/config/page-title.ts` — `/calendar` の見出しを足す
- `apps/web/src/features/notifications/components/settings-view.tsx` — 予定の前日通知の行を足す（オン/オフと時刻）。ヒントは「明日に予定がある日だけ、前日の HH:MM に届く」に、初期値がオンであることと、時刻を変えた日の通知の扱いを添える。`summary`（今は必須）は、予定の行では件数を出さないので、省略できるようにする
- `apps/web/src/features/groups/api/assign-memos.ts` — 500 件ずつの集計に `skippedSchedule` を足す（今は `skippedTodo` だけを足し合わせて返す）
- `apps/web/src/features/groups/components/` — 「グループに追加」のダイアログの説明を「やること・予定のメモは入れられません。」に直し、トーストに `skippedSchedule` の件数も出す。グループの入力欄のタグから「予定」を除く
- 取り直すキー: 予定にした・日時を変えた・予定を作った・削除したあとは `["memos"]` を取り直す（カレンダーも同じデータなので更新される）

### デプロイの順序と互換

- PR をマージする前に、人が手元で `pnpm --filter @repo/api db:migrate:remote` を実行する（AI のセッションでは実行しない）。逆の順にすると、新しい API が無い列とタグを使い、メモの一覧と作成が止まる
- マイグレーション済みで API が旧版の状態は問題ない。追加するのは NULL 可の列と新しいテーブル、タグの行だけである
- Web と API は同じ Worker で配信し、PWA は自動で更新する（`autoUpdate`、`skipWaiting`、`clientsClaim`、画面に戻ったときの更新の確認）。旧版の Web が新しい API を読む時間は短い。ただし、旧版の Web が開いたまま新しい API の一覧（`tag: "schedule"` を含む）を読むと、旧版の `memoTagSchema` で失敗し、再読み込みするまでメモの一覧が読めない
- **ロールバックできない状態がある**: 予定のメモが DB に1件でもあると、旧版の API は `tag: "schedule"` を検証できず、メモの一覧と作成が止まる。DB は前進のみ（`.agents/rules/db.md`）なので、旧版には戻せない。不具合のときは、新版を直して出し直す

### ログ（`.agents/rules/logging.md`）

| event | status / action | キー | いつ |
| --- | --- | --- | --- |
| `schedule.daily` | `success` / `unreachable` / `transient` / `failed` / `skipped`（`reason: empty` か `stale`）/ `tick` | `userId`, `count`（予定の件数）, `messages`（通数） | 予定の日次通知のとき（`todo.daily` と同じ形）。`skipped`（`stale`）は、日付をまたいで捨てるとき1回だけ。`tick` には `sent`、`empty`、`stale`、`failed` の件数を出す |
| `memo.schedule` | `failed` | `userId`, `memoId` | `PUT /api/memos/:id/schedule` の更新が D1 の例外で失敗したとき |

- 予定の本文と日付は、ログに出さない。D1 の例外は投げ直さない（Drizzle の例外の message に、SQL と params（日付や本文）が入り、既定のハンドラがそのままログに出すため）

## 4. テスト影響範囲

- `memos/idempotency.test.ts` — `ExistingMemoRow`（`MemoRow`）に日時の列が増えるため、既存のケースの `existing` に `scheduledDate: null` と `scheduledTime: null` を足す
- `memos/index.test.ts` — `toMemoResponse` の既存のケースが使う `MemoRow` の `base` にも、同じ2つの列を足す（足さないと `pnpm typecheck` が落ちる。vitest 自体は通る）。`createMemoRequestSchema` の検査が増えるが、既存のケースは日時を持たないので通る。パース結果の `toEqual` は、日時のキーを増やさない（`.transform` で `null` を足さない）
- `groups/index.test.ts` — `groupMemoTagSchema` が `schedule` も拒否するようになる。既存の「`todo` を拒否」のケースは壊れない。`assignMemosResponseSchema` の既存のテストは無いので、新規として5章に置く
- `notifications/settings.test.ts` — `StoredNotificationSettings` と `applySettingsPatch` は変えないので、既存のケースは壊れない。`toNotificationSettings` の引数が増えるため、その呼び出しの期待値だけを更新する
- `notifications/message.test.ts` と `message-daily.test.ts` — `packDigestMessages` を直しても出力が変わらないことの確認になる（期待値は変えない）
- `memos/classify.test.ts` — 変えない（`#schedule` が受け付けられないことを足す）

## 5. 新規テストケース

単体（Vitest。`.agents/rules/testing.md` に従い、D1 と R2 は立てない。テスト対象の関数を `vi.mock` で差し替えない）。共有の Zod のテストは、既存の `createMemoRequestSchema` と同じく API 側に置く。

Web の純粋関数（登録時の注意の出し分け `willBeNotified`、カレンダーの並び順、月の格子）には、自動テストを書かない。壊れても表示の乱れと注意の出し分けの誤りにとどまり、画面を見ればすぐ気づけるため。下の「ブラウザでの確認」で境界を確かめる。なお、通知の文面の並び順（API）は、`message-schedule.test.ts` で守る。

契約の Zod（`memos/index.test.ts` と `groups/index.test.ts`）:

- `scheduleDateSchema`: `2026-11-03`、`2028-02-29`、`9999-12-31` は可（上限なし）。`2026-2-3`（桁が足りない）、`2026-02-30`（実在しない）、`2027-02-29`（閏年でない）は不可
- `scheduleTimeSchema`: `00:00`、`09:00`、`23:59` は可。`24:00`、`12:60`、`9:00`、`12:5`、`aa:bb`、`12:00:00` は不可
- `createMemoRequestSchema`:
  - タグ `schedule` で日付なしは不可。日付ありは可。`scheduledTime` が省略でも `null` でも可。`2026-02-30` は不可。`24:00` は不可
  - タグ `schedule` で、空白だけの本文は不可（日付ありでも）
  - タグ `tweet`・`tech`・`todo`・`other` に日付が付いたら不可。日付なしで時刻だけは、どのタグでも不可
- `setScheduleRequestSchema`: 時刻が省略と `null` のどちらでも可。日付なしは不可
- `apiErrorSchema`: `code` が `schedule_date_past` と `not_schedulable` のとき、`code` が保持される。知らない `code` は `undefined`（既存の確認）
- `assignMemosResponseSchema`: `{ added, skippedTodo, skippedSchedule }` は可。`skippedSchedule` が無い応答は不可（必須）。負の数と小数は不可
- `createGroupMemoRequestSchema`: タグ `schedule` は不可。本文の `scheduledDate` と `scheduledTime` は捨てられる

`memos/index.test.ts`（ルートと `toMemoResponse`）:

- `toMemoResponse`: 予定のメモは `scheduledDate` と `scheduledTime` を返す。時刻が null の予定は時刻のキーを持たない。予定以外のメモは日時のキーを持たない
- `PUT /api/memos/:id/schedule`:
  - セッションなしで 401（不正な JSON でも 401 が先）
  - セッション付きで、不正な日付・日付なしで時刻だけ・`scheduledTime: "24:00"`・65 文字の `:id`・不正な JSON が 400
  - 過去の日付（`2000-01-01`）は 400 と `code: "schedule_date_past"`（過去の判定は DB に触る前に行うので、D1 なしでルートのテストになる）
- `POST /api/memos` に `{ tag: "schedule", scheduledDate: "2000-01-01", content: "x" }` → 400 と同じ `code`

`memos/schedule.test.ts`:

- `isPastScheduleDate`: `now` が `2026-11-02T14:59:59Z`（JST で 11/2 23:59:59）のとき、`2026-11-02` は過去でない。`2026-11-02T15:00:00Z`（JST で 11/3 0:00）のとき、`2026-11-02` は過去。`2026-11-03` は過去でない。年またぎ: `2026-12-31T14:59:59Z` で `2026-12-31` は過去でない。`2026-12-31T15:00:00Z`（JST で 2027-01-01 0:00）で `2026-12-31` は過去
- `decideScheduleSet`:
  - `memo: null` → `not_found`
  - タグ `tweet` でグループなし → `ok`。タグ `schedule` でグループなし → `ok`（日時の変更）
  - タグ `tech`・`todo`・`other` でグループなし → `not_schedulable`
  - グループに入っている `tweet` → `not_schedulable`。グループに入っている `schedule` → `not_schedulable`。グループに入っている `other` → `not_schedulable`
- `validateCreateSchedule`:
  - タグ `schedule` と `groupId` の同時指定 → `invalid`
  - タグ `schedule` で過去の日付 → `past_date`。`groupId` もあっても `invalid` が先
  - タグ `schedule` で今日以降の日付、`groupId` なし → `ok`
  - タグ `tweet` で `groupId` あり、日付なし → `ok`（普通のグループへの作成）

`memos/idempotency.test.ts` の `decideCreateResult`:

- タグ `schedule` で、日付と時刻が既存と同じ → 既存。日付が違う → 衝突。時刻が違う（なしと有りも違う扱い）→ 衝突。入力の `scheduledTime` が省略で既存が `null` → 既存（同一視）
- 既存が `tweet` で入力が `schedule`（日付あり）→ 衝突。入力が `schedule` で既存の日付が `null` → 衝突
- 別のユーザーの行は、日付と時刻が同じでも違っても、衝突（日時の違いで結果が変わらない）
- タグが `schedule` でない入力は、既存の日時を比べない

`memos/classify.test.ts`: `#schedule 11/3 歯医者` と `＃schedule 歯医者` は `unknown_tag`。`REPLY_TEXT.unknown_tag` の文言は変えない。

`notifications/window-schedule.test.ts`（時刻は JST の例。UTC の入力も入れる）:

- `scheduleTargetDate`（通知の時刻が 00:30 の設定）: 11/2 00:29 → `2026-11-02`。11/2 00:30 → `2026-11-03`。11/30 21:00 → `2026-12-01`。12/31 21:00 → `2027-01-01`。2028-02-28 21:00 → `2028-02-29`。2027-02-28 21:00 → `2027-03-01`
- `scheduleTargetToMark`（通知の時刻が 20:00 の設定）: 19:59:59 → `null`。20:00:00 → 対象日あり。12/31 21:00 → `2027-01-01`。通知の時刻が 08:00 で、11/2 19:00 → `2026-11-03`
- 日付をまたぐ判定（通知の時刻が 00:30 の設定）: 11/2 23:59 は同じ日。11/3 00:00 は違う日（直近の通知が 11/2 00:30）。UTC の入力: `2026-11-02T14:59:59Z`（JST 11/2 23:59:59）は同じ日、`2026-11-02T15:10:00Z`（JST 11/3 00:10）は違う日

`notifications/schedule-digest.test.ts`（設定は 20:00、`last_target_date` を表で固定）:

| now (JST) | `last_target_date` | 期待値 |
| --- | --- | --- |
| 11/2 19:59:59 | `2026-11-02` | `already` |
| 11/2 19:59:59 | `2026-11-01` | `stale`（処理済みにする対象日 `2026-11-02`） |
| 11/2 19:59:59 | `null` | `not_due` |
| 11/2 20:00:00 | `2026-11-02` | 送る（対象日 `2026-11-03`） |
| 11/2 20:00:00 | `null` | 送る（対象日 `2026-11-03`） |
| 11/2 20:00:00 | `2026-11-03` | `already` |
| 11/2 20:00:00 | `2026-11-04` | `already` |
| 11/3 00:10 | `2026-11-02` | `stale`（対象日 `2026-11-03`） |
| 11/3 00:10 | `null` | `not_due` |
| 11/3 00:11（`stale` を処理した直後） | `2026-11-03` | `already`（毎分ログが出ない） |

- 無効なら、ほかの条件によらず `disabled`
- 同じ対象日で、時刻だけ変わっても再送されない: 20:00 に送ったあと（`last_target_date` が `2026-11-03`）、設定を 21:00 に変えて 11/2 21:00 → `already`
- 通知の時刻が 00:00 の設定で 11/2 00:00、`last_target_date` が `2026-11-02` → 送る（対象日 `2026-11-03`）
- 通知の時刻が 23:59 の設定で 11/2 23:58（直近の通知は 11/1 23:59、対象日は `2026-11-02`）: `last_target_date` が `null` → `not_due`。`2026-11-02` → `already`。`2026-11-01` → `stale`

`afterSchedulePush`（`notifications/schedule-digest.test.ts`）:

- `success` → 元に戻さず、設定も変えない
- `transient`（先取り前が `2026-11-02`）→ 元に戻す値は `2026-11-02`。先取り前が `null` → 元に戻す値は `null`
- `unreachable` → 設定をオフにして理由を残す。元には戻さない

`notifications/settings.test.ts`:

- `DEFAULT_SCHEDULE_DAILY` はオンの 20:00 で、`lastTargetDate` は `null`
- `planScheduleSettingsChange`（20:00 の設定。`now` は JST）:
  - すでにオンで、変更のないパッチ `{}` → 変更なし、`markTarget` は `null`
  - オンにする、11/2 21:00 → `markTarget` は `2026-11-03`。オンにする、11/2 19:00 → `null`
  - 時刻を変える（オンのまま）、20:00 から 08:00、11/2 19:00 → `markTarget` は `2026-11-03`（今日の 08:00 はもう来ている）。20:00 から 21:00、11/2 19:00 → `null`
  - オフのまま時刻だけ変える → `markTarget` は `null`
  - オフにする → `markTarget` は `null`、`disabledReason` を消す
  - 自動オフ（`disabledReason` あり）から `enabled: true` → 理由を消し、時刻が来ていれば `markTarget`
  - `enabled` と `time` の同時パッチ。年末の `now`（12/31 21:00）では `markTarget` が `2027-01-01`
- `changedSections`: `{ techWeeklyDay: 3 }` → 技術だけ。`{ todoDailyTime: "09:00" }` → やることだけ。`{ scheduleDailyEnabled: false }` → 予定だけ。`{}` → どれも書かない
- `toNotificationSettings`: 予定の行が無いとき（既定値）→ `scheduleDailyEnabled: true`、`scheduleDailyTime: "20:00"`、`scheduleDisabledReason: null`。`lastTargetDate` は応答に出ない。自動オフの理由が出る。技術・やることの出力は変わらない

`notifications/run-independently.test.ts`: 3つのうち1つが例外を投げても、残りが実行される。失敗が数えられる。すべて成功なら失敗は0。

`notifications/index.test.ts`: `PATCH /api/notifications` で、`scheduleDailyTime` が `20:00:00`・`25:00` なら 400。`scheduleDailyEnabled` が文字列なら 400。`00:00` と `23:59` は通る。予定の項目だけのパッチは、ほかの項目なしで通る。

`notifications/message-schedule.test.ts`:

- 見出しは「明日の予定 N件（M/D）」。日付は0埋めなし（`2026-11-03` → `11/3`、`2027-01-01` → `1/1`、`2026-12-31` → `12/31`）。予定が1件でも「明日の予定 1件（11/3）」。あふれたときも、見出しの N は全件数
- 時刻のない予定が先頭で「時間未定」と出る。`00:00` は時刻ありとして「時間未定」より後ろ、`01:00` より前。`09:00` と `10:00` は時刻順。同じ時刻は登録順（`createdAt` の古い順）。時刻のない予定どうしも登録順
- 本文の切り詰め: 200 文字ちょうどは切らない。201 文字は切る。200 文字を超える URL だけの本文は切らない。URL を含む文章は、テキストとして切る
- 上限: URL だけの予定が5件なら1通のまま、6件なら2通に分かれる（プレビューの上限）。5000 文字ちょうどは1通、+1文字で2通。5 通ちょうどは収まり、6 通目はあふれて「他N件は Web で」が付く
- 予定が0件なら空の配列

ブラウザでの確認（`wrangler dev --local` に別のユーザーのデータを作って確かめる。自動テストにしないもの）:

- 【P0】他人のメモの id で `PUT /api/memos/:id/schedule` を送る: 404 で、他人のメモは変わらない。存在しない id も同じ 404
- 【P0】通知の取得が `user_id` で絞られている: ユーザー A と B が同じ日に予定を作り、`scheduled` を手動で動かす（下の「通知」）。A の実行が B の本文を含まず、送信先が A の `lineUserId` であること
- 過去の日付: 入力欄と「予定にする」のダイアログにエラーが出る。API に直接送っても 400（`schedule_date_past`）。今日の日付は登録できる。日付が過ぎた既存の予定は、一覧に残り、日付そのままで時刻だけ変えると 400。日付を未来に変えれば保存できる。ダイアログの初期値は今日
- タグが技術・やること・その他のメモに `PUT` を送る → 409（`not_schedulable`）。グループに入っているメモに送る → 409。同じ内容で `PUT` を2回送っても 200 で、状態が変わらない
- つぶやきを「予定にする」→ 予定のバッジと日時が出る。時刻なしで「時間未定」と出る。「日時を変更」で日付と時刻が変わり、カレンダーの点が移る。「予定にする」のダイアログに「予定からつぶやきには戻せません」と出る
- Web の入力欄でタグ「予定」を選ぶ: 日付が必須。本文が空では登録できない。保存したメモが予定として出る。送信を失敗させる（DevTools で `POST /api/memos` を遮断）と、本文と日時が残り「保存できませんでした。」が出る
- 通知が届かない日付の注意（通知の時刻が 20:00 の設定で）: 今日の日付 → 注意が出る。明日の日付で、今が JST の 19:59 まで → 出ない。20:00 以降 → 出る。明後日以降 → 出ない。通知の設定をオフにする → どの日付でも出ない。年またぎ: 1/1 の予定を、12/31 の 19:59 に登録 → 出ない、20:00 に登録 → 出る。通知の時刻を 00:00 にして、明日の予定を今日の 00:00 以降に登録 → 出る。23:59 にして 23:58 に登録 → 出ない。入力欄と日時ダイアログの両方で確かめる。OS のタイムゾーンを JST 以外（UTC や America/New_York）にしても、JST の日付と時刻で決まる
- オフライン: 入力欄で予定を選べない。「予定にする」「日時を変更」が使えない。入力欄で予定を選んだあとにオフラインにして送信すると、送らずに入力が残り、つぶやきが積まれない。カレンダーに「オフラインのため予定は表示できません」が出る（点が無いだけの月と区別できる）
- 「グループに追加」に、やること1件・予定1件・つぶやき1件を含める → つぶやきだけが入り、トーストに「やること 1 件」と「予定 1 件」が出る（`skippedTodo: 1`、`skippedSchedule: 1`）。グループの入力欄のタグに「予定」が出ない
- カレンダー: 予定がある日に点が付く（同じ日に複数あっても点は1つ）。日を選ぶとその日の予定が時刻順（時間未定が先頭、`00:00` は時間未定の後ろで `01:00` の前、`09:00` は `10:00` の前、同じ時刻は登録順）に出る。月の移動（12 月 → 1 月をまたぐことを含む）と今日の強調。一覧から日時の変更と削除（確認ダイアログ）ができ、削除すると点が消える。予定が1件もない日は「予定はありません」と出る。再読み込みすると、今日を選んだ状態に戻る
- メモタブ: 予定のバッジと日時、絞り込み「予定」、件数。予定の削除でも確認ダイアログが出る
- 設定画面: 予定の前日通知のオン/オフと時刻が保存され、再読み込みしても残る。通知の時刻が今日すでに来ている状態でオンにする、または時刻を変えると、D1 の `last_target_date` が対象日になる（来ていないときは変わらない）。予定の設定を変えても、技術・やることの設定の行が書き換わらない。設定の行が無い既存のユーザー（`schedule_daily_settings` の行を消した状態）で、既定値（オン、20:00）が見える
- 通知（`scheduled` を `curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"` で手動で動かし、ログと D1 で確かめる）:
  - 同じ分に2回続けて動かしても、2回目は先取りに失敗して何も送らない（`last_target_date` が対象日のまま、ログに `success` が1回）
  - 予定が0件の日は、`last_target_date` が対象日になり、`skipped`（`empty`）が1回だけ出る。通知の時刻を過ぎてから登録した予定が、そのあとの分で送られない。時刻の前に登録した予定は送られる
  - 日付をまたいだ時刻に動かすと、送らず、`skipped`（`stale`）が1回だけ出る。次の分は何も出ない
  - LINE のトークンを壊した状態では、`transient` になり、`last_target_date` が元に戻って、次の分に再試行される
- スマホ幅とダークモードで、カレンダーとダイアログが崩れない

確かめられないもの（自動テストでもブラウザでも再現できない）:

- LINE への実際の送信。判断・後始末・文面だけを単体テストで守る
- Web のカレンダーの並び順と、LINE の通知の並び順が同じであること（別々に書くため、自動では守らない）
- 通知の時刻に cron が動くこと。ローカルでは上の `curl` で `scheduled` を手動で動かす
- 先取りが、同じ分の並列実行で本当に1件になること（`curl` を直列に2回打つ確認は、直列の重複しか守れない。1文の条件付き UPDATE が原子的であることに頼る）
- 元に戻す書き込みが失敗したとき、その日の分が送られず `failed` のログが出ること
- 「グループに追加」と「予定にする」が同時に動いた競合（両方の SQL が相手の条件を持つことに頼る）

## 6. 実装順

1. 契約（`packages/shared` の `schedule.ts`、`memo.ts`、`group.ts`、`error.ts`、`notification.ts`）と、その Zod のテスト: 型の定義だけで判断が少ないため、安価なモデル（Sonnet）のサブエージェントに任せる
2. マイグレーションと、`schedule_daily_settings` の repository: 同上（Sonnet）。生成された SQL が `memos` を作り直していないことを確かめ、タグの行を追記する
3. `memos` の変更（`schedule.ts`、service、repository、idempotency、`PUT` のルート、「グループに追加」の除外）とテスト: 認可と競合の条件が中核のため、上位モデル（Opus）がメインのセッションで実装する
4. `notifications` の変更（`window.ts`、`schedule-digest.ts`、`message.ts`、settings、repository の先取り、service、`scheduled.ts`、設定の更新で変更のあった表だけを書くこと）とテスト、`line-security.md`・`logging.md`・`db.md` の更新: 日付の境界と二重送信の防止（先取り）が中核のため、Opus がメインのセッションで実装する
5. Web: タグの追加、入力欄の「予定」、メモカードの「予定にする」「日時を変更」、日時のダイアログ: 見た目の判断が多いため、Opus がメインのセッションで実装し、`design-taste-frontend` スキルと `docs/design-system.md` に合わせる
6. Web: カレンダーのページ（月の格子、日の一覧、日時の変更と削除、サイドバー、見出し）: 同上（Opus）
7. Web: 設定画面の予定通知の行、「グループに追加」の説明とトーストの更新、グループの入力欄のタグ: 小さな変更のため、Sonnet のサブエージェントに任せる
8. 実装の観点別レビュー: `design-reviewer`、`edge-case-reviewer`、`security-reviewer` の3体（いずれも Opus）を並列で起動し、P0・P1 を直す（`.agents/rules/review.md`）
9. マージ前に、人が `pnpm --filter @repo/api db:migrate:remote` を実行する（AI のセッションでは実行しない）

## 7. コミット前テスト実行

- ローカルのマイグレーション `pnpm --filter @repo/api db:migrate:local` と、生成された SQL の目視確認
- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @repo/api test`
- `pnpm build`
- ブラウザで、5章の「ブラウザでの確認」を確かめる（予定にする → 日時の変更 → カレンダーでの確認 → 削除の流れと、スマホ幅、ダークモードを含む）

## 8. スコープ外

- 終了時刻、繰り返し（毎週など）
- 当日の朝や、直前（1時間前など）の通知
- LINE からの予定の登録（LINE のタグの廃止は別の issue）
- 予定からつぶやきへ戻す操作、ほかのタグ同士の切り替え
- カレンダーでの日ごとのメモと日報
- 予定の完了・キャンセルの状態
- 日本時間以外のタイムゾーン
- 月ごとに予定を返す専用の API（メモが増えて重くなったときに検討する）
- 設定画面に、次の通知に含まれる予定の件数を出すこと
- カレンダーの月と選んだ日を URL に出すこと
- サイドバーに予定のウィジェット（件数と通知のオン/オフ）を出すこと（「メモ一覧」の件数には、予定も過去の予定も含まれる）
- 登録できる日付の上限（遠い未来も登録できる）
- 既存の「技術の週次」と「やることの毎日」の通知の、二重送信の防止（今の形は、送信後の書き込みが失敗すると、同じ通知が毎分届きうる。別の作業にする）
- LINE への送信の失敗理由（429 や 5xx）をログに出すこと（`pushTextMessages` が失敗を `transient` にまとめているため。別の作業にする）
