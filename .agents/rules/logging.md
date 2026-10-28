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
2. ラップするのは外部 I/O と失敗しうる副作用だけ（LINE webhook、LINE API、OGP 取得、R2 の削除、ダイジェスト送信）。`classify` や `window` のような純粋関数はログしない
3. 失敗を成功として返さない。`status` か `action` に失敗を残す。webhook は受理後の失敗をログし、応答を 200 から変えない。ダイジェストはユーザー1人の失敗で tick を止めず、`failed` を数えて次へ進む
4. 引数は ID・件数・理由だけ。メモ本文、LINE のメッセージ、webhook の raw body、オブジェクト全体は渡さない
5. 成功のたびに出さない。失敗、不受理、ダイジェストの tick 集計だけ出す

## 標準キー

| キー | 内容 |
| --- | --- |
| event | `line.webhook` / `line.event` / `memo.create` / `memo.ogp` / `memo.image.delete` / `group.create` / `group.rename` / `group.delete` / `group.touch` / `group.assign` / `memo.schedule` / `connpass.sync` / `tech.weekly` / `todo.daily` / `schedule.daily` |
| status / action | `invalid_signature` / `failed` / `ignored` / `skipped` / `tick` / `duplicate` / `conflict` など |
| userId | アプリのユーザー ID |
| lineUserId | 不受理・未登録のときだけ |
| memoId | メモ ID |
| groupId | グループ ID。グループ名はユーザーの入力なので出さない |
| reason | `empty` や `group` などの短い理由 |
| count / sent / failed | ダイジェストの件数 |
| messages | ダイジェストの通数（`schedule.daily`） |

## 秘密値をログに流さない

チャネルシークレット、チャネルアクセストークン、`SESSION_SECRET`、`sid`、OAuth の code、`replyToken`、署名ヘッダ、メモ本文、LINE のメッセージ本文は書かない。

```ts
// ❌
console.log("webhook", rawBody, env.LINE_CHANNEL_ACCESS_TOKEN);

// ✅
logJson({ event: "line.webhook", status: "invalid_signature" });
```
