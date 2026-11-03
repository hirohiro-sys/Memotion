---
name: Memotion
description: 午後の光の下の、使い込んだ紙のノート。暖かい off-white の地に、青 1 色だけを置く。
colors:
  paper-warmth: "#f6f5f4"
  pure-white: "#ffffff"
  ink-black: "#000000"
  charcoal: "#111111"
  stone: "#757575"
  graphite: "#615d59"
  slate: "#696969"
  notion-blue: "#0075de"
  signal-blue: "#097fe8"
  sky-tint: "#e6f3fe"
  sky-wash: "#62aef0"
  marigold: "#ffb110"
  saffron: "#e89d01"
  coral: "#f64932"
  vermillion: "#e32d14"
  mocha: "#b18164"
  midnight-ink: "#02093a"
typography:
  caption:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    lineHeight: 1.33
    letterSpacing: "0.12px"
  body-sm:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.43
  body:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  heading-sm:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    lineHeight: 1.27
    letterSpacing: "-0.242px"
  heading:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    lineHeight: 1.5
  display:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "72px"
    lineHeight: 1.21
    letterSpacing: "-2.016px"
  editorial:
    fontFamily: "Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif"
    fontSize: "18px"
    lineHeight: 1.56
rounded:
  small: "4px"
  button: "8px"
  card: "12px"
  pill: "9999px"
spacing:
  element-gap: "8px"
  card-padding: "24px"
  section-gap: "80px"
components:
  button-primary:
    backgroundColor: "{colors.notion-blue}"
    textColor: "{colors.pure-white}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.button}"
    padding: "6px 15px"
  button-secondary:
    backgroundColor: "{colors.sky-tint}"
    textColor: "{colors.notion-blue}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.button}"
    padding: "6px 15px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.small}"
    padding: "6px 15px"
  card:
    backgroundColor: "{colors.pure-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: Memotion

## Overview

**Creative North Star: "The Afternoon Notebook"**

午後の光の下に置いた、使い込んだ紙のノート。暖かい off-white の地（#f6f5f4）は、冷たい白ではなく、手触りのある紙の色として働く。区切りは 1px の細い罫線と 12px の角で作り、影や飾りは使わない。ノートの罫線で区切った節のように、情報を静かに並べる。

色は句読点として少しだけ使う。主アクションの青（#0075de）が唯一の強い色で、黄・珊瑚・茶は付箋のように、種類や状態を見分けたい場所にだけ現れる。動きは 200ms の ease 遷移で、軽く、飾らない。

このシステムは、既存の `apps/web/src/index.css` と `Button` コンポーネントから読み取った記録で、新しい方向を決めるものではない。値の正本は `index.css`。

**Key Characteristics:**
- 暖かい off-white の紙地に、白いカードを 1px の罫線で置く
- 影・グラデーションなしのフラットな面
- 主アクションの青は 1 画面に 1 つ
- 角は 4 / 8 / 12px とピル（9999px）の 4 段階
- ライトとダークの両方を持ち、ダークは Charcoal 系の面で、黒ベタにしない

## Colors

近モノクロの紙地に、青 1 色と、付箋のような暖色の小さな差し色。

### Primary
- **Notion Blue** (#0075de): 主アクション、アクティブなナビ、フォーカスリング。1 画面に主アクションは 1 つ。画面の約 10% を超えない。

### Secondary
- **Sky Tint** (#e6f3fe): 副次アクション、淡い選択状態、ホバーの背景。ダークでは Notion Blue を Charcoal に 38% 混ぜた色に変わる。
- **Sky Wash** (#62aef0): ダークのフォーカスリングと強調文字。ダークの二次ボタン文字。
- **Signal Blue** (#097fe8): 装飾的な青の変化。

### Tertiary
- **Marigold** (#ffb110): 目を引く暖色の強調、付箋のような注意の場所。
- **Saffron** (#e89d01): Marigold の沈んだ変化。
- **Coral** (#f64932): 装飾的な暖色。ダークでは危険操作の色として使う。
- **Vermillion** (#e32d14): 危険操作（destructive）の色。
- **Mocha** (#b18164): 土っぽい暖色の差し色。

### Neutral
- **Paper Warmth** (#f6f5f4): ページの地。ページ背景に `#ffffff` を使わない。
- **Pure White** (#ffffff): カード、ポップオーバー、サイドバーの面。
- **Ink Black** (#000000): 本文、見出し。95%、90%、60% のアルファで階層を作り、新しい灰色を足さない。
- **Charcoal** (#111111): ダークの地。
- **Stone** (#757575): 補助テキスト、無効状態のラベル。
- **Graphite** (#615d59): 暖色寄りの本文用グレー。
- **Slate** (#696969): カード内の補助テキスト。
- **Midnight Ink** (#02093a): 装飾の帯や、強調の背景。ダークのページ全面には使わない。

### Named Rules
**The One Blue Rule.** 強い色は Notion Blue だけ。主アクションは 1 画面に 1 つで、その希少さが目印になる。
**The Token Only Rule.** 色は `bg-primary` や `bg-marigold` などのトークンで指す。`bg-[#0075de]` のような hex の直書きをしない。

## Typography

**Display Font:** Inter Variable（fallback: Inter, ui-sans-serif, system-ui）
**Body Font:** Inter Variable（同上）
**Editorial Font:** Iowan Old Style（fallback: Palatino, Georgia, serif）

**Character:** 幾何学的で人間味のあるサンセリフ 1 つを軸にし、serif は編集者の一文のような場所だけに使う。大きいサイズほど字間を詰めて、締まった印象にする。数字は lining numerals（`"lnum"`）。

### Hierarchy
- **Display** (600〜700, 72px, 1.21, -2.016px): ランディングの見出しのみ。製品 UI では使わない。
- **Heading** (600, 40px / 22px, 1.5 / 1.27): ページ・節の見出し。22px は `heading-sm`。
- **Body** (400, 16px, 1.5): 本文。`text-body`。
- **Body Small** (400〜500, 14px, 1.43): ボタン、一覧、補助の本文。`text-body-sm`。
- **Caption** (400, 12px, 1.33, 0.12px): メタ情報、日時。
- **Editorial** (400, 18px, 1.56): 編集者の一文。serif を使うのはここだけ。

### Named Rules
**The One Serif Rule.** serif は短い一文の強調だけに使い、見出し階層を二重にしない。

## Layout

ページ最大幅は 1440px。カード内の余白は 24px、要素間の基本の隙間は 8px、セクション間は 80px。リズムは Tailwind の標準スケール（`p-4` など）で組み、`@theme` に `--spacing-*` を足さない（足すと標準の余白が壊れる）。

ナビはサイドバー（白い面）とトップバー。モバイルでは PWA としても使うので、縦のスクロールを前提にする。

## Elevation & Depth

影を使わないフラットなシステム。奥行きは、紙地（#f6f5f4）の上に白いカードを置いた色の差と、1px の細い罫線（ライトは黒 8%、ダークは白 14%）で表す。ホバーなどの状態も影ではなく、背景色の変化で示す。

### Named Rules
**The Flat Rule.** カードに `shadow-*` を付けない。グラデーションも使わない。

## Shapes

角は 4 段階。**Small** (4px) は outline ボタンや小さな要素。**Button** (8px) は標準のボタン。**Card** (12px) はカードとパネル。**Pill** (9999px) はタグと状態表示。細い 1px の罫線で面を区切り、装飾的な形は使わない。

## Components

### Buttons
- **Shape:** 8px の角（`rounded-lg`）。outline と xs は 4〜6px。
- **Primary:** Notion Blue の面に白い文字、余白 6px 15px。ホバーで 80% の濃さ。
- **Secondary:** Sky Tint の面に青い文字。ホバーで Sky Tint。
- **Ghost:** 透明な面。ホバーで淡い灰色の面。
- **Destructive:** 危険色の 10% の面に危険色の文字。
- **Hover / Focus:** 遷移は 200ms ease。フォーカスは `ring` の 3px の輪郭。押下で 1px 下がる。無効は 50% の透明度。

### Cards / Containers
- **Corner Style:** 12px
- **Background:** Pure White（ダークは Charcoal に白を 13% 混ぜた色）
- **Shadow Strategy:** なし。
- **Border:** 1px、黒 8%。
- **Internal Padding:** 24px（`p-6`）

### Navigation
サイドバーは白い面で、アクティブな項目は Sky Tint。ブランドロックはマークと `Memotion` の文字。ライトとダークの切替を持つ。

### Tags / Status
`rounded-full` のピル。

## Do's and Don'ts

### Do:
- **Do** ページの地に `bg-background`（ライトは #f6f5f4、ダークは Charcoal 系）を使う。
- **Do** カードは `bg-card rounded-xl border border-border p-6` で組む。
- **Do** 主アクションは画面に 1 つにする。次点は secondary、その他は ghost。
- **Do** 文字は `text-foreground`、`text-stone`、`text-graphite` で階層を作る。
- **Do** ダーク対応は `.dark` のトークン差し替えに任せ、コンポーネント側に `dark:` の色を足さない。

### Don't:
- **Don't** ページ背景を `#ffffff` にしない。
- **Don't** カードに `shadow-*` を付けない。グラデーションを使わない。
- **Don't** hex をコンポーネントに直書きしない。
- **Don't** `@theme` に `--spacing-*` を足さない。
- **Don't** 製品 UI に 72px の見出し、ヒーロー pill、キャラクターマークを置かない。
