---
description: API ログは JSON 1行。要約だけ出し、秘密と本文は残さない
globs: apps/api/src/**/*.ts
alwaysApply: false
paths:
  - "apps/api/src/**/*.ts"
---

# ログ

Workers のログは `console.log(JSON.stringify(fields))` の1行。各ファイルの `logJson` がそれだけを行う。`src/lib/logging/` はない。

## ルール

1. 文章やオブジェクトを `console.log` / `console.error` に直接渡さない。出すなら既存の `logJson` と同じ JSON 1行にする。新しい helper は足さない
2. ラップするのは外部 I/O と失敗しうる副作用だけ（LINE webhook、LINE API、Notion API、OGP 取得、R2 の削除、ダイジェスト送信）。`classify` や `window` のような純粋関数はログしない
3. 失敗を成功として返さない。`status` か `action` に失敗を残す。webhook は受理後の失敗をログし、応答を 200 から変えない。LINE 通知は 1 つの失敗でほかの通知を止めない
4. 引数は ID・件数・理由だけ。メモ本文、LINE のメッセージ、webhook の raw body、オブジェクト全体は渡さない
5. 成功のたびに出さない。失敗と不受理だけ出す。LINE 通知は、送った回（成功を含む）とスキップした回に 1 行出し、時刻が来ていない分は出さない

## 標準キー

| キー | 内容 |
| --- | --- |
| event | `line.webhook` / `line.event` / `memo.create` / `memo.ogp` / `memo.notion` / `memo.dedup` / `memo.image.delete` / `group.create` / `group.rename` / `group.delete` / `group.touch` / `group.assign` / `memo.schedule` / `memo.tag` / `tech.weekly` / `todo.daily` / `schedule.daily` / `daily_report.generate` |
| status / action | `invalid_signature` / `failed` / `ignored` / `skipped` / `duplicate` / `conflict` など |
| userId | アプリのユーザー ID |
| lineUserId | 不受理・未登録のときだけ |
| memoId | メモ ID |
| groupId | グループ ID。グループ名はユーザーの入力なので出さない |
| reason | `empty` や `group` などの短い理由 |
| count | LINE 通知に入れたメモの件数 |
| messages | LINE 通知の通数 |
| httpStatus | 外部 API の HTTP の状態（`memo.notion`）。ネットワークの失敗は 0 |

LINE 通知（`tech.weekly` / `todo.daily` / `schedule.daily`）は、送ったら `action` に送信の結果（`success` / `unreachable` / `transient`）と `count`、`messages`。送らなかったら `action: skipped` と `reason`（`baseline` / `empty` / `no_recipient` / `no_secret` / `invalid` / `stale`）。Notion を読めなかったら `action: failed`、`reason: upstream`、`httpStatus`。送り先の LINE ユーザーID と本文は出さない。

重複判定の記録（KV）の失敗は `memo.dedup`（`status: failed`、`reason` は `read` / `write`、`memoId`。LINE の読み込みの失敗はメモがまだ無いので `memoId` を付けない）。本文と LINE のメッセージ ID は出さない。

日報の生成失敗は `daily_report.generate`（`status: failed`、`reason` は `limit` / `upstream` / `empty` / `too_long` / `no_secret` / `write`、`userId`）。429 は `limit`。バインディングが無い 502 は `no_secret`。空は `empty`。2万字超は `too_long`。生成先の失敗と、日時を直せない材料は `upstream`。保存の失敗は `write`。本文、URL、プロンプト、応答は出さない。成功は出さない。

## 秘密値をログに流さない

チャネルシークレット、チャネルアクセストークン、`NOTION_TOKEN`、`SESSION_SECRET`、`sid`、OAuth の code、`replyToken`、署名ヘッダ、メモ本文、LINE のメッセージ本文は書かない。

```ts
// ❌
console.log("webhook", rawBody, env.LINE_CHANNEL_ACCESS_TOKEN);

// ✅
logJson({ event: "line.webhook", status: "invalid_signature" });
```
