---
version: 1
slug: "src-routes-app-index-tsx"
primary_target: "src/routes/_app/index.tsx"
related_targets: ["src/routes/_app.tsx","src/routes/login.tsx"]
---

# Surface brief: apps/web 全画面

## Scope
Operate。ログイン、メモ一覧、グループ、カレンダー、日報、設定、サイドバー、トップバー。全面刷新。構成と機能は変えない。

## Audience / task
自分用のメモを、LINE から送った後に Web とスマホで見返し、探し、整理する。頻度は 1 日に数回、数秒〜数分。

## Direction contract
THESIS: 定番のメモアプリを、最高の仕上げで作る。凝った世界観ではなく、整った格子、実在の文字階層、1 色の主操作で、仕事道具の信頼感を出す。
OWN-WORLD: 白に近い中性の地、薄いトーンの面、1px の細い罫線。主操作は深いインクの青緑 1 色。タグは 5 色の淡い面と濃い文字。ダークは青みを帯びた黒で、ライトと同じ重さ。影は浮くものだけ（ダイアログ、メニュー）。
STORY: 開いて 2 秒で、今日のメモと探す手段が見つかる。種類（つぶやき、技術、やること、予定、その他）が色と文字で一目で分かる。
FIRST VIEWPORT: 左に 232px のサイドバー（ロゴ、メモ、カレンダー、日報、設定）、中央に最大 720px の列。上から検索、入力欄と主ボタン「保存」、タグの絞り込み、日付ごとのメモ一覧（時刻、タグ、本文）。
FORM: 定番（canon）。基準は Notion / Craft。seed: none (unavailable)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
