---
description: D1 マイグレーションは前進のみ。一意性と参照は DB、認可と業務フローはアプリ
globs: apps/api/migrations/**/*.sql,apps/api/src/db/**/*.ts,apps/api/src/features/**/repository.ts
alwaysApply: false
paths:
  - "apps/api/migrations/**/*.sql"
  - "apps/api/src/db/**/*.ts"
  - "apps/api/src/features/**/repository.ts"
---

# DB

D1（SQLite）と Drizzle。Prisma はない。スキーマの正本は `apps/api/src/db/schema.ts`。

## マイグレーション

- 適用済みの `apps/api/migrations/*.sql` は編集しない。スキーマを変えたら `pnpm --filter @repo/api db:generate` で新しいマイグレーションを足す
- `migrations/meta` は生成物。手で直さない
- remote は `db:migrate:remote` で前進のみ。ロールバックしない。ローカル D1 だけリセットしてよい
- 既存テーブルへ UNIQUE や NOT NULL を足す前に、違反する行がないか読み取り専用で確認する

## 設定

ユーザーごとの通知（有効、曜日、時刻、`lastSentAt`）は `tech_weekly_settings` と `todo_daily_settings` が正。予定の前日通知（有効、時刻、`lastTargetDate`）は `schedule_daily_settings` が正。`DEFAULT_TECH_WEEKLY`・`DEFAULT_TODO_DAILY`・`DEFAULT_SCHEDULE_DAILY` は行が無いときの初期値だけで、保存済みの値を上書きしない。

connpass 連携は `connpass_settings`（ユーザー名と、取り込みの先取りに使う `last_synced_at`）と `connpass_imports`（connpass のイベントと予定の対応表）が正。`connpass_imports.memo_id` は `onDelete: set null` で、NULL の行は「ユーザーが予定を消したので、もう取り込まない」を表す。この行は消さない（消すと、次の取り込みで予定が戻る）。取り込みが予定を消すときだけ、予定と対応表の行を `db.batch` で一緒に消す。

日報は `daily_reports`（ユーザー、日付、種類 `work` / `personal` の組で1本。本文、構成、状態、作成と更新の時刻）、`daily_report_memos`（日報とメモの対応。行の `id` は `crypto.randomUUID()`）、`daily_report_ai_uses`（ユーザーと JST の日付ごとの生成回数。行の `id` も `crypto.randomUUID()`）が正。日報を消すと対応だけ消え、メモは残る。メモを消すと対応だけ消え、日報の本文は残る。日報を消しても生成回数は戻さない。回数の行を消しても日報は残る。

`schedule_daily_settings.last_target_date` は、cron の先取り（条件付きの1文）と、設定の更新で処理済みにするときだけ進める。設定画面の更新は `enabled`・`time`・`disabled_reason` だけを書き、`last_target_date` を古い値で上書きしない。

## DBが守るもの／アプリが守るもの

| DB（制約で守る） | アプリ（コードで守る） |
| --- | --- |
| 一意性。`users.line_user_id`、`tags.slug`、`memos.line_message_id`、設定の `user_id`、日報の `(user_id, report_date, kind)`、日報とメモの `(report_id, memo_id)`、生成回数の `(user_id, used_on)` | 認可。`row.userId === sessionUserId`。LINE は allowlist |
| 参照。メモと設定の `user_id`、メモの `tag_id`（`onDelete: restrict`） | 業務フロー。`ogp_state`、JST 窓と `lastSentAt`、タグと `media_type` の妥当性 |
| 同時に破れる一意性（同じ `line_message_id` の二重挿入） | LINE との整合。署名検証、送信失敗、ダイジェストの二重送信防止 |

判断基準: UI を通らない書き込み（ダイジェスト、手動 SQL、バグ）でも壊れてはいけないなら DB 制約にする。誰が見てよいか、どの順で状態が進むかはアプリに置く。
