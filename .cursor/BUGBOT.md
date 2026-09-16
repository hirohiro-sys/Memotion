# Review Standards

個人用メモ（Memotion）。本番は同一 Worker が `/` に Web、`/api/*` に API を出す。レビューは変更行のバグ・権限漏れ・契約崩れを優先する。リネームや見た目の好みは無視する。

## 言語

指摘・説明・修正案はすべて日本語で書く。英語の見出しやコード識別子はそのままでよい。英語だけのコメントは出さない。

## 指摘する

- 公開 API が `@repo/shared` の Zod を通さず入出力している
- `apps/api` の feature が `index`（ルート）/ `service` / `repository` を跨いで DB や LINE I/O を直叩きしている
- API・分類・ダイジェストなど振る舞いを変えたのに対応テストがない（`*.test.ts`）
- Web の色・余白・角丸を新規発明している（正本は `docs/design-system.md` と `apps/web/src/index.css`）

## 無視する

- 生成物、lockfile、マイグレーションの機械的差分
- ファイル移動だけのリファクタ
- Biome / 型で既に落ちるスタイル指摘

## セキュリティ境界

次を触る PR は、権限と副作用を明示的に確認する。

### 認証

- LINE Login は allowlist 済みユーザーだけセッションを発行する。未登録は `/login?error=denied`
- `sid` は httpOnly。OAuth `state` は発行と消費が対になる
- `/api/me`・`/api/memos*`・`/api/notifications` は `readSessionUserId` 必須。401 を省略しない

### LINE webhook

- `/api/line/webhook` は署名検証前に本文を解釈・永続化しない
- 無効署名は 400。受理は 200 を先に返し、処理は `waitUntil`
- 画像は公開 URL にしない。R2 キーは `{userId}/{memoId}`。配信はセッション付き `/api/memos/:id/image`
- `lineMessageId` の重複は挿入せず `duplicate` にする

### メモと通知

- 画像取得・削除は `row.userId === sessionUserId` を確認する。他人のメモに届かない
- 週次ダイジェストは allowlist ユーザーだけ。JST 窓と `lastSentAt` を壊して二重送信や取りこぼしを作らない

## よくある崩れ

- Web 新規エンドポイントで `apiFetch` せず、レスポンスを shared schema で parse していない
- LINE 失敗理由を増やしたのに `REPLY_TEXT` / `replyTextFor` とテストを更新していない
- メモ画像キーや thumbnail に公開オリジンを埋め込んでいる
- Cookie の `secure` / `sameSite` / path を緩めた
