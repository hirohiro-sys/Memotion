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
2. ラップするのは外部 I/O と失敗しうる副作用だけ（LINE webhook、LINE API、Notion API、KV、ダイジェスト送信）。`classify` や `window` のような純粋関数はログしない
3. 失敗を成功として返さない。`status` か `action` に失敗を残す。webhook は受理後の失敗をログし、応答を 200 から変えない。LINE 通知は 1 つの失敗でほかの通知を止めない
4. 引数は ID・件数・理由だけ。メモ本文、LINE のメッセージ、webhook の raw body、オブジェクト全体は渡さない
5. 成功のたびに出さない。失敗と不受理だけ出す。LINE 通知は、送った回（成功を含む）とスキップした回に 1 行出し、時刻が来ていない分は出さない

## 標準キー

| キー | 内容 |
| --- | --- |
| event | `line.webhook` / `line.event` / `memo.create` / `memo.notion` / `memo.dedup` / `tech.weekly` / `todo.daily` / `schedule.daily` |
| status / action | `invalid_signature` / `failed` / `ignored` / `skipped` / `duplicate` / `conflict` など |
| userId | アプリのユーザー ID |
| lineUserId | 不受理・未登録のときだけ |
| memoId | メモ ID |
| reason | `empty` や `no_secret` などの短い理由 |
| count | LINE 通知に入れたメモの件数 |
| messages | LINE 通知の通数 |
| httpStatus | 外部 API の HTTP の状態（`memo.notion`）。ネットワークの失敗は 0 |

LINE 通知（`tech.weekly` / `todo.daily` / `schedule.daily`）は、送ったら `action` に送信の結果（`success` / `unreachable` / `transient`）と `count`、`messages`。Notion を 5 ページで打ち切ったら `truncated: true`。送らなかったら `action: skipped` と `reason`（`baseline` / `empty` / `no_recipient` / `no_secret` / `invalid` / `stale`）。Notion を読めなかったら `action: failed`、`reason: upstream`、`httpStatus`。送り先の LINE ユーザーID と本文は出さない。

メモの保存（`memo.notion`）は、Notion に書けなかったら `status: failed` と `httpStatus`、秘密が無ければ `status: skipped` と `reason: no_secret`、同じメモIDのページが既にあって作らなかったら `status: duplicate`。どれも `memoId` を付ける。結果の分からない失敗のあと、検索で保存済みとわかったときは出さない。

重複判定の記録（KV）の失敗は `memo.dedup`（`status: failed`、`reason` は `read` / `write`、`memoId`。LINE の読み込みの失敗はメモがまだ無いので `memoId` を付けない）。本文と LINE のメッセージ ID は出さない。

## 秘密値をログに流さない

チャネルシークレット、チャネルアクセストークン、`NOTION_TOKEN`、`SESSION_SECRET`、`sid`、OAuth の code、`replyToken`、署名ヘッダ、メモ本文、LINE のメッセージ本文は書かない。

```ts
// ❌
console.log("webhook", rawBody, env.LINE_CHANNEL_ACCESS_TOKEN);

// ✅
logJson({ event: "line.webhook", status: "invalid_signature" });
```
