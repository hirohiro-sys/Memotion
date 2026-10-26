# プラン: カレンダーで日ごとのメモを見る

状態: ドラフト｜元資料: なし（チャットでの要件の合意）｜issue: #68

## 1. 概要

カレンダーで日を選んだとき、右の枠（スマホではカレンダーの下）の「予定」の節の下に「この日のメモ」の節を足す。その日に書いたメモ（作成日時の JST の日付が一致するもの）を、書いた時刻の順に並べる。見るだけで、編集と削除はメモタブで行う。Web だけの変更で、API と契約は変えない。

## 2. 背景

カレンダーは、予定のある日を見せるために作り、あとから日ごとのメモと日報を見られる画面に育てる計画だった（`docs/plans/schedule-calendar.md`）。その最初の一歩として、「この日に何を書いたか」を振り返れるようにする。

## 3. 詳細設計

### 合意済みの仕様

- 日を選ぶと、今の「予定」の節の下に「この日のメモ」の節を出す。予定の節と同じ枠（`DaySchedulePanel` の `section`）の中に置く
- どのメモを出すか: 作成日時（`createdAt`）を JST に直した日付が、選んだ日と一致するメモ
- 予定（`tag: schedule`）は出さない。予定は予定日の「予定」の節にだけ出る。例: 10/26 に「11/3 歯医者」を登録しても、10/26 の「この日のメモ」には出ない
- グループに入ったメモは出さない。今のメモ一覧の取得（`GET /api/memos`。グループに入っていないメモ）をそのまま使い、新しい API は作らない
- 1件の表示: 書いた時刻（`HH:MM`、JST）、タグのバッジ、本文（3行で切る）。並びは書いた時刻の古い順
- 見るだけ。日時の変更・削除・グループへの追加などの操作は置かない（メモタブで行う）
- 月表示のマスには、メモを書いた日の印を付けない。点は今と同じく、予定のある日だけ

### 判断済みの論点（実装時に迷わないための決め）

- 作成日時の JST の日付は、`apps/web/src/features/schedule/jst.ts` に `jstDateOf(iso: string): string` を足して求める（既存の `jstToday` と同じ +9 時間のずらし。`jstToday(new Date(iso))` と同じ値）。端末のタイムゾーンには依らない
- 書いた時刻の表示は、`jstClock(new Date(memo.createdAt))` を使う（JST）。メモタブのカードの `formatDate` は端末のタイムゾーンで出すが、カレンダーは日付を JST で切るので、時刻も JST に揃える（日付は JST、時刻は端末時刻、というずれを作らない）
- 日ごとのまとめは、純粋関数 `groupMemosByCreatedDate(memos)`（新規 `features/schedule/day-memos.ts`）に置く。予定を除き、JST の作成日で `Map<string, Memo[]>` にまとめ、各日を `createdAt` の古い順に並べる。`createdAt` が同じなら `id` の順（並びを安定させる）
- 本文の表示: 他のメモカードと同じく、`content` を `whitespace-pre-wrap break-words line-clamp-3` で出す。URL のメモはタイトル取得済みでも `content`（URL そのもの）を出す。画像のメモはサムネイル（`thumbnailUrl`。`/api/memos/:id/image`）を小さく出す。セッション付きで配信される既存の経路なので、認可は変わらない
- タグのバッジは `config/tag-meta.ts` の `TAG_META[tag].label` と `className` を使う（新しい色は作らない。`.agents/rules/design.md`）
- 空の日は「この日に書いたメモはありません」を出す（予定の節の「予定はありません」と同じ形。アイコンは lucide の既存のものから選ぶ）
- 見出し: 予定の節は今の「11月3日（火）の予定」のまま。メモの節は「この日のメモ」とし、2つの節の間に区切り線を置く
- 読み込み中・取得失敗・オフラインの表示は、今の `CalendarView` のもの（予定と共通）をそのまま使う。メモの節だけの表示は足さない（同じ1つの取得のため）
- 削除などでメモ一覧（`["memos"]`）を取り直すと、メモの節も一緒に更新される。追加の取り直しは要らない
- 件数が多い日: 上限は設けず、全件を並べる（個人用で、1日のメモは多くても数十件の見込み）。重くなったら、日付で絞る API を別に検討する（スコープ外）

### 機能境界

- Web だけの変更。API・`packages/shared`・DB は変えない
- メモの節は `features/schedule/` に置く（カレンダーの画面の一部のため）。メモのタグの表示は `config/tag-meta.ts` を読むだけで、`features/memos/` の部品（`MemoCard`）は使わない（操作つきのカードは要らないため）

### 認可

- 変更なし。メモは既存の `GET /api/memos`（セッション必須）で取り、画像は既存の `/api/memos/:id/image`（セッション必須、持ち主の確認あり）で出す

### 変更するファイル（見込み）

Web:

- `apps/web/src/features/schedule/jst.ts` — `jstDateOf(iso)` を足す
- `apps/web/src/features/schedule/day-memos.ts` — 新規。`groupMemosByCreatedDate(memos)`（予定を除き、JST の作成日でまとめ、古い順に並べる。純粋関数）
- `apps/web/src/features/schedule/components/day-memo-list.tsx` — 新規。「この日のメモ」の節。時刻・タグのバッジ・本文（画像はサムネイル）を並べる。空の日の表示
- `apps/web/src/features/schedule/components/day-schedule-list.tsx` — `DaySchedulePanel` に、メモの節を差し込む場所（`children` か `memos` の props）を足す。予定の節の見た目は変えない
- `apps/web/src/features/schedule/components/calendar-view.tsx` — `groupMemosByCreatedDate` を `useMemo` で求め、選んだ日のメモを `DaySchedulePanel` に渡す

## 4. テスト影響範囲

- API のテストへの影響はない（API を変えないため）
- Web には単体テストの仕組みが無い（`pnpm --filter @repo/api test` だけ）。純粋関数（`groupMemosByCreatedDate`、`jstDateOf`）の検査は、ブラウザでの確認で代える。`.agents/rules/review.md` のとおり、Web だけの変更はテスト不足として扱わない

## 5. 新規テストケース

ブラウザでの確認（`pnpm dev`。データはローカルの D1）:

- 今日を選ぶ → 今日書いたつぶやき・技術・やることが、書いた時刻の古い順に「この日のメモ」に出る
- 今日、明日の日付の予定を登録する → 今日の「この日のメモ」には出ず、明日を選ぶと「予定」の節に出る
- メモを書いていない日を選ぶ → 「この日に書いたメモはありません」が出る。予定の節は今のまま
- JST の日付の境目: 端末のタイムゾーンを UTC にして、JST の 00:30 に書いたメモ（UTC では前日の 15:30）を見る → JST の日付の日に出て、時刻は 00:30 と出る（シードの `createdAt` を手で入れて確かめる）
- 画像のメモ → サムネイルが出る。URL のメモ → URL が出る
- グループに入れたメモ → カレンダーから消える
- メモタブでメモを削除 → カレンダーに戻ると、その日のメモから消えている
- 本文の長いメモ → 3行で切れる。スマホ幅（375px）で、予定の節とメモの節が縦に並び、横にはみ出さない
- オフラインで開く → 今のオフラインの表示だけが出て、メモの節は出ない

## 6. 実装順

1. `jstDateOf` と `groupMemosByCreatedDate`（純粋関数）
2. `day-memo-list.tsx` と、`DaySchedulePanel`・`CalendarView` への組み込み
3. ブラウザで5章を確かめる（スマホ幅を含む）
4. 実装完了後、別セッションの AI レビュー（`.agents/rules/review.md`）。P0・P1 を直す

## 7. コミット前テスト実行

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @repo/api test`（API を変えないが、ワークスペースの決まりとして回す）
- `pnpm build`

## 8. スコープ外

- グループに入ったメモを日ごとに出すこと（日付で絞る取得 API が要る）
- 月表示のマスに、メモを書いた日の印や件数を出すこと
- カレンダーの日の一覧から、メモを編集・削除すること
- 日報（今後実装予定）
- 日付で絞って返す専用の API（メモが増えて重くなったときに検討する）
- 選んだ日を URL に出すこと
