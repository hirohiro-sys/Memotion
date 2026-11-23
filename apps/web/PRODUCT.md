# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
現在の利用者は作者本人 1 人。日常や業務の気づき、あとで見返したい記事や投稿を、LINE のキープメモに隙間時間で書き残している（インタースティシャルジャーナリング）。将来は他の人にも使ってもらう可能性があるが、その時期と範囲は未定。

## Product Purpose
メモを最も手軽に送る入口になる。送ったメモは Notion のデータベースに入り、一覧とカレンダーは Notion で見る。通知は LINE に届く。Web は、LINE を開かずに書きたいときの投入専用の 1 画面で、見返しの画面は持たない（#133 の方針転換、#141）。

主な機能（apps/web の feature）: ログイン（auth）、メモの投入と未送信の再送（memos）、予定の日時の入力（schedule）、PWA。

## Positioning
LINE を入口にしつつ、Web でもモバイルでも使え、自分用にカスタマイズできる。LINE は 1 日に何度も開くので、書いた内容が自然に目に入る。似た用途の既存ツールにはこの前提が揃っていない。

## Operating Context
- 入力は LINE のメッセージ（テキスト、記事や投稿のリンク）と、Web の投入画面（テキスト、種類、予定の日時）。見返しは Notion で行う。
- 本番は同一オリジンの Cloudflare Worker が `/` に Web、`/api/*` に API を配信する。
- メモ本文と秘密は、保存先の Notion 以外に出さない。

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
- 画面は投入の 1 画面だけ。一覧、カレンダー、日報、グループの画面を Web に戻さない。

## Evidence on Hand
実利用中のデータは作者本人のメモのみ。ユーザー数、レビュー、導入事例などの実績はなく、作ってはいけない。

## Product Principles
- 開いたらすぐ書ける。入力欄に最初から書ける状態で開き、送ったら次をすぐ書ける。
- 電波が無くても書ける。送れなかったメモは端末に残し、戻ったら自動で送る。
- 軽く、すぐ開ける。何気ない一言メモに重さを感じさせない。
- 個人用を出発点にして、他の人が使っても迷わない画面にする。
