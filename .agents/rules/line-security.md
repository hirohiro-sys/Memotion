---
description: 認証・LINE webhook・画像・ダイジェストのセキュリティ境界
globs: apps/api/src/{features,lib}/**/*.ts,apps/web/src/**/*.{ts,tsx}
alwaysApply: false
paths:
  - "apps/api/src/{features,lib}/**/*.ts"
  - "apps/web/src/**/*.{ts,tsx}"
---

# LINE / auth

- LINE Login は allowlist 済みユーザーだけセッションを発行する。未登録は `/login?error=denied`
- `/api/auth/dev` は、リクエストと `APP_URL` がどちらも http のループバックのときだけ、固定のローカルユーザーにセッションを発行する。それ以外は 404。Cookie の属性は LINE ログインと同じ。`wrangler.toml` の D1 を `remote = true` にすると、このルートは本番の `users` に行を足す
- `sid` は httpOnly。OAuth `state` は発行と消費が対になる
- `/api/me`・`/api/memos*`・`/api/groups*`・`/api/notifications` は `readSessionUserId` 必須。401 を省略しない
- `/api/groups/:id*` は `groups.user_id = セッションのユーザー ID` で引く。無いグループと他人のグループは区別せず 404（`code: "group_not_found"`）
- `PUT /api/memos/:id/schedule` は `readSessionUserId` 必須。検査は「401 → `:id` と本文の 400 → 過去の日付の 400（`schedule_date_past`）→ 持ち主と状態」の順。他人のメモと存在しないメモは区別せず 404。更新の SQL は `memos.user_id`・`group_id IS NULL`・タグ（`tweet` か `schedule`）で絞った1文にする
- `/api/connpass/*`（設定の取得・保存と `sync`）は `readSessionUserId` 必須。設定・対応表（`connpass_imports`）・予定は、セッションのユーザーの `user_id` で絞る。connpass への呼び出しは宛先を `https://connpass.com/api/v2/` に固定し、ユーザー名は `URLSearchParams` で渡す。応答は信用せず検査する。API キー（`CONNPASS_API_KEY`）は Worker の secret だけに置き、DB・画面・ログに出さない
- Cookie の `secure` / `sameSite` / path を緩めない
- webhook は署名検証前に本文を解釈・永続化しない
- 無効署名は 400。受理は 200 + `waitUntil`
- 画像は公開 URL にしない。R2 キーは `{userId}/{memoId}`。配信はセッション付き `/api/memos/:id/image`。取得・削除は `row.userId === sessionUserId`
- 画像キーと thumbnail に公開オリジンを埋め込まない。thumbnail は `/api/memos/:id/image`
- `lineMessageId` 重複は挿入せず `duplicate`
- LINE 失敗理由を増やしたら `REPLY_TEXT` / `replyTextFor` とテストを同時更新
- 週次ダイジェストは allowlist。JST 窓と `lastSentAt` を壊さない
- Web の新しい API 呼び出しは `apiFetch` する。JSON の入出力は `packages/shared` の Zod で parse する
