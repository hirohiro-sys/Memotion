---
description: 認証・LINE webhook・Notion への保存・ダイジェストのセキュリティ境界
globs: apps/api/src/{features,lib}/**/*.ts,apps/web/src/**/*.{ts,tsx}
alwaysApply: false
paths:
  - "apps/api/src/{features,lib}/**/*.ts"
  - "apps/web/src/**/*.{ts,tsx}"
---

# LINE / auth

- LINE Login と LINE の受信は、環境変数 `ALLOWED_LINE_USER_IDS` にある LINE ユーザーだけを許す。持ち主はみな `APP_USER_ID`。どちらかが無ければ誰も許さない（fail closed）。未登録のログインは `/login?error=denied`
- `/api/auth/dev` は、リクエストと `APP_URL` がどちらも http のループバックのときだけ、固定のローカルユーザーにセッションを発行する。それ以外は 404。Cookie の属性は LINE ログインと同じ
- `sid` は httpOnly。OAuth `state` は発行と消費が対になる
- `/api/me` と `POST /api/memos` は `readSessionUserId` 必須。401 を省略しない。`POST /api/memos` の検査は「401 → 本文の 400 → 過去の日付の 400（`schedule_date_past`）」の順で、Notion と KV に触る前に行う
- Cookie の `secure` / `sameSite` / path を緩めない
- webhook は署名検証前に本文を解釈・永続化しない
- 無効署名は 400。受理は 200 + `waitUntil`
- LINE の画像は保存しない（#136）。テキスト以外のメッセージは `unsupported` を返信する
- `lineMessageId` 重複は保存せず `duplicate`。KV（`DEDUP`）の `line-message:<id>` で見分ける。記録は Notion に書けたあとに置く
- Web の再送（端末が付けた `id`）は KV の `web-memo:<id>` を先に見る。持ち主・タグ・本文・予定が同じときだけ 200 で返し、それ以外は内容を返さず 409。記録が無ければ Notion を「メモID」で検索し、あれば作らない。KV の値は持ち主の確認に使い、応答やログに `userId` を出さない
- メモの保存先は Notion だけ。書けなければ Web は 502（端末が送り直す）、LINE は `save_failed` を返信する。書き込みが結果の分からない失敗（ネットワーク、5xx）のときは、メモIDで検索して保存済みかを確かめる。Notion へは `lib/notion/client.ts` だけが書く。トークンは `NOTION_TOKEN`（`.dev.vars` と `wrangler secret`）に置き、リポジトリ、ログ、応答に出さない。ページの作成の応答の本文は読まずに捨て、HTTP の状態だけ返す。Notion に送るのはメモの本文、種類、日時、URL、入力元、メモIDだけで、ユーザー ID は送らない
- LINE 失敗理由を増やしたら `REPLY_TEXT` / `replyTextFor` とテストを同時更新
- LINE 通知（週次・日次・予定の前日）は `NOTIFY_LINE_USER_ID` の1人だけに送る。JST 窓と Durable Object（`NOTIFY_STATE`）の送信済みの記録を壊さない
- Notion の検索（`queryDataSource`）の応答は、通知に要るプロパティ（本文、種類、記録日時、予定日時、URL）だけを読み、ログと応答に出さない。メモIDの検索は、見つかったかどうかだけを見る
- Web の新しい API 呼び出しは `apiFetch` する。JSON の入出力は `packages/shared` の Zod で parse する
