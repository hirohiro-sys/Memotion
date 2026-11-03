---
name: Memotion
description: 仕事道具のように整った、静かなメモの作業台。インクの青緑が主操作の 1 色。
colors:
  background: "#f8f9fa"
  card: "#ffffff"
  sidebar: "#f1f3f5"
  foreground: "#16191f"
  graphite: "#3a404a"
  stone: "#5f6672"
  border: "#e2e5e9"
  input: "#d5d9de"
  primary: "#0b6b6e"
  primary-soft: "#e3f1f1"
  destructive: "#c7371f"
  tag-tweet: "#fbe8ee"
  tag-tweet-fg: "#8f1a3d"
  tag-tech: "#e5edfb"
  tag-tech-fg: "#1c4b9c"
  tag-todo: "#fbefd5"
  tag-todo-fg: "#7a4f00"
  tag-schedule: "#ece7fa"
  tag-schedule-fg: "#533a9e"
  tag-other: "#eceff3"
  tag-other-fg: "#434c5c"
typography:
  caption:
    fontFamily: "Inter Variable, Inter, Hiragino Kaku Gothic ProN, Hiragino Sans, BIZ UDPGothic, Yu Gothic UI, Meiryo, sans-serif"
    fontSize: "12px"
    lineHeight: 1.4
    letterSpacing: "0.01em"
  body-sm:
    fontFamily: "Inter Variable, Inter, Hiragino Kaku Gothic ProN, Hiragino Sans, BIZ UDPGothic, Yu Gothic UI, Meiryo, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  body:
    fontFamily: "Inter Variable, Inter, Hiragino Kaku Gothic ProN, Hiragino Sans, BIZ UDPGothic, Yu Gothic UI, Meiryo, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  heading-sm:
    fontFamily: "Inter Variable, Inter, Hiragino Kaku Gothic ProN, Hiragino Sans, BIZ UDPGothic, Yu Gothic UI, Meiryo, sans-serif"
    fontSize: "20px"
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Inter Variable, Inter, Hiragino Kaku Gothic ProN, Hiragino Sans, BIZ UDPGothic, Yu Gothic UI, Meiryo, sans-serif"
    fontSize: "28px"
    lineHeight: 1.25
    letterSpacing: "-0.02em"
rounded:
  small: "4px"
  control: "6px"
  button: "8px"
  card: "10px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.body-sm}"
    rounded: "{rounded.button}"
    padding: "6px 15px"
  button-secondary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.button}"
    padding: "6px 15px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "16px"
  tag-badge:
    backgroundColor: "{colors.tag-tech}"
    textColor: "{colors.tag-tech-fg}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "2px 6px"
---

# Design System: Memotion

## Overview

**Creative North Star: "The Quiet Workbench"**

仕事道具のように整った、静かな作業台。派手な世界観は持たず、整った格子、実在の文字階層、主操作 1 色の青緑で、信頼感を出す。基準は Notion と Craft。定番を、最高の仕上げで作る。

面は青みを帯びた中性色で、ライトは明るい灰白、ダークは青みのある黒。両者は同じ重さで作る。枠は 1px の細い罫線で、影は浮くもの（ダイアログ、メニュー）にしか付けない。種類（つぶやき、技術、やること、予定、その他）は、淡い面と濃い文字の 5 色で見分ける。

2026-11-03 の全面刷新で、旧「午後の紙のノート」から作り直した。構成と機能は変えていない。値の正本は `apps/web/src/index.css`。

**Key Characteristics:**
- 青みを帯びた中性の面と、1px の細い罫線
- 主操作は深いインクの青緑 1 色。画面の約 10% を超えない
- タグは 5 色の淡い面と濃い文字の組。角は 6px の小さな角丸で、丸薬にしない
- 影は浮くものだけ。カードは平らなまま
- ライトとダークを同じ重さで仕上げる

## Colors

近モノクロの面に、青緑 1 色と、タグの 5 色。

### Primary
- **Ink Teal** (#0b6b6e): 主操作、選択中のタブとチップ、フォーカスリング。ダークでは #3fb8b0（上に濃い緑の文字 #06211f）。

### Secondary
- **Teal Wash** (#e3f1f1): 副次ボタン、ホバー、選択の淡い背景。ダークは #16302f。

### Tag (種類)
- **つぶやき** Rose (#fbe8ee / #8f1a3d)
- **技術** Blue (#e5edfb / #1c4b9c)
- **やること** Amber (#fbefd5 / #7a4f00)
- **予定** Violet (#ece7fa / #533a9e)
- **その他** Slate (#eceff3 / #434c5c)

ダークでは、面を暗く、文字を明るい同系色に差し替える（`.dark` のトークン）。

### Neutral
- **Cloud** (#f8f9fa): ページの地。
- **Surface** (#ffffff): カード、ポップオーバー。
- **Rail** (#f1f3f5): サイドバー。
- **Ink** (#16191f): 本文、見出し。
- **Graphite** (#3a404a): 本文の補助。
- **Stone** (#5f6672): 補助テキスト。白地で 5:1 以上。
- **Hairline** (#e2e5e9): 罫線。入力の枠は #d5d9de。
- **Alert Red** (#c7371f): 破壊的操作。

### Named Rules
**The One Teal Rule.** 強い色は青緑だけ。種類の色は、小さなタグの面にとどめる。
**The Token Only Rule.** 色は `bg-primary`、`text-stone`、`bg-tag-tech` のようなトークンで指す。hex を直書きしない。

## Typography

**Font:** Inter Variable に、日本語はヒラギノ角ゴ（Hiragino Kaku Gothic ProN）、BIZ UDPGothic、游ゴシックの順で落とす。

**Character:** 実用的で読みやすい 1 書体。階層は大きさと太さで作り、字間は大きい見出しだけ少し詰める。数字は `tabular-nums` で揃える。

### Hierarchy
- **Heading** (600, 28px, 1.25, -0.02em): ログインなどの大見出し。
- **Heading Small** (600, 20px, 1.3): ページ名（トップバー）。
- **Body** (400, 15px, 1.6): 本文。
- **Body Small** (400〜500, 14px, 1.5): ボタン、一覧、入力。
- **Caption** (400〜500, 12px, 1.4): メタ情報、日時、タグ。

## Layout

サイドバー（開いて 260px、畳むと 64px）と、上のページ名バー（高さ 56px）。本体は最大幅 1440px で、メモは 3 列のカード格子。余白は Tailwind の標準スケールで組み、`@theme` に `--spacing-*` を足さない。モバイルではサイドバーが引き出しになる。

## Elevation & Depth

カードは平ら。奥行きは、地（#f8f9fa）と白いカードの差と、1px の罫線で表す。ダイアログとメニューだけ、`shadow-pop`（細い 1px の影と、広くやわらかい影の 2 段）を持つ。

### Named Rules
**The Float Only Rule.** 影は、画面の上に浮くもの（ダイアログ、メニュー）にだけ付ける。

## Shapes

角は 4 段階。**Small** (4px)、**Control** (6px、タグとチップ)、**Button** (8px、ボタンと入力)、**Card** (10px)。タグとチップは丸薬にしない。

## Components

### Buttons
- **Shape:** 8px の角。xs は 6px。
- **Primary:** Ink Teal の面に白い文字、余白 6px 15px。ホバーで 80% の濃さ。
- **Secondary:** Teal Wash の面に青緑の文字。
- **Ghost:** 透明。ホバーで淡い灰色。
- **Destructive:** Alert Red の 10% の面に赤い文字。
- **Focus:** 2px の青緑のアウトライン。押下で 1px 下がる。遷移は 200ms。

### Cards / Containers
- **Corner Style:** 10px
- **Background:** Surface（ダークは #171b23）
- **Border:** 1px。ホバーで `input` の色。選択中は青緑の枠と 1px のリング。
- **Internal Padding:** 16px

### Tag Badge
- **Style:** 種類ごとの淡い面と濃い文字、6px の角、12px の文字。

### Navigation
- サイドバーは Rail の面。選択中の項目は一段濃い面と太い文字。ページ名バーは地と同じ色で、下に 1px の罫線だけ。
- メモ／グループのタブは、選択中に下 2px の青緑の線。

## Do's and Don'ts

### Do:
- **Do** ページの地は `bg-background`、カードは `bg-card rounded-xl border border-border`。
- **Do** 主操作は画面に 1 つ。次点は secondary、その他は ghost。
- **Do** 文字は `text-foreground`、`text-graphite`、`text-stone` で階層を作る。
- **Do** 種類の色は `bg-tag-*` と `text-tag-*-fg` の組で使う。
- **Do** ダーク対応は `.dark` のトークン差し替えに任せ、コンポーネントに `dark:` の色を足さない。

### Don't:
- **Don't** カードに影を付けない。影は `shadow-pop` で、浮くものだけ。
- **Don't** hex をコンポーネントに直書きしない。
- **Don't** タグやチップを `rounded-full` にしない。
- **Don't** `@theme` に `--spacing-*` を足さない。
- **Don't** 見出しの上に、小さな説明ラベル（kicker）を置かない。
