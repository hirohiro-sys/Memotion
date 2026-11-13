# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
現在の利用者は作者本人 1 人。日常や業務の気づき、あとで見返したい記事や投稿を、LINE のキープメモに隙間時間で書き残している（インタースティシャルジャーナリング）。将来は他の人にも使ってもらう可能性があるが、その時期と範囲は未定。

## Product Purpose
LINE に残したメモを、種類ごとに整理して Web とモバイルで見返せるようにする。LINE のキープメモは種類が混ざって縦に積まれ、量が増えるとスクロールが大変になる。Notion は一言メモには重く、目に入る頻度も低い。Memotion は LINE を入口にして、書く手間を増やさずに、見返しやすさだけを足す。

主な機能（apps/web の feature）: メモ（auth / memos）、予定カードとメモ検索（schedule）、カレンダー、日報（選んだメモから生成）、グループ、通知、PWA。

## Positioning
LINE を入口にしつつ、Web でもモバイルでも使え、自分用にカスタマイズできる。LINE は 1 日に何度も開くので、書いた内容が自然に目に入る。似た用途の既存ツールにはこの前提が揃っていない。

## Operating Context
- 入力は LINE のメッセージ（テキスト、画像、記事や投稿のリンク）。Web は見返しと整理のための画面。
- 本番は同一オリジンの Cloudflare Worker が `/` に Web、`/api/*` に API を配信する。
- 画像は公開せず、認証付きで配信する。メモ本文と秘密は外に出さない。

## Capabilities and Constraints
- Web は Vite / React 19 / TanStack Router・Query / Tailwind CSS 4。
- API 契約は `packages/shared` の Zod が正本。
- `apps/web/src/routeTree.gen.ts` は生成物なので触らない。
- 色・余白・角丸の値の正本は `apps/web/src/index.css`。

## Brand Commitments
- プロダクト名は Memotion。ロゴのマーク（`public/memotion-mark.png`、黒の3つの輪。ダークでは反転）は変えない。
- 既存の見た目（午後の紙のノート、Notion 風トークン）は確約にしない。2026-11-03 に全面刷新を決めた。
- 見た目の水準は「プロフェッショナル」。基準の製品は Notion / Craft。定番を最高の仕上げで作り、凝った世界観は持ち込まない（利用者が選んだ。決定画面の「定番」を採用）。
- ライトとダークは同じ重さで仕上げる。
- 画面構成と機能は変えない。変えるのは見た目だけ。

## Evidence on Hand
実利用中のデータは作者本人のメモのみ。ユーザー数、レビュー、導入事例などの実績はなく、作ってはいけない。

## Product Principles
- 書く場所は LINE のまま。Web は見返しのための画面で、入力の手間を増やさない。
- 種類が混ざったメモを、後から区別して見つけられることを最優先にする。
- 軽く、すぐ開ける。何気ない一言メモに重さを感じさせない。
- 個人用を出発点にして、他の人が使っても迷わない画面にする。
