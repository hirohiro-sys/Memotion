# プランの形式

このファイルは記入例である。実装との照合対象にしない。実プランは同じディレクトリに機能ごとのファイルで置く。

記入例は請求書 OCR であり、このリポジトリの機能ではない。

---

# プラン: 請求書のアップロードとOCR読み取り

状態: レビュー中｜元資料: docs/requirements/invoice-ocr.md（要件定義）

## 1. 概要

請求書のPDF・JPEGをアップロードすると、OCRで金額・取引先・日付を抽出し、仕訳の下書きとして表示する。読み取れなかった項目は空欄＋要確認マークで示し、人間が確定するまで仕訳には反映しない。

## 2. 背景

要件定義のストーリー1（P1）に対応する。経理担当者の転記作業が月約20時間あり、その大半が「PDFを開いて金額と取引先を打ち直す」作業のため、読み取りの自動化で仕訳開始までの時間を削る。FR-001〜003・SC-001が受け入れの基準。

## 3. 詳細設計

変更するファイル:

- `src/features/invoice/invoice.controller.ts` — アップロード受け口。`POST /invoices/upload` を追加（multipart、PDF/JPEGのみ受理、10MB上限）
- `src/features/invoice/ocr.service.ts` — 新規。OCR APIの呼び出しと結果の正規化（金額: 整数円、日付: ISO 8601、取引先: 文字列）
- `src/features/invoice/draft.service.ts` — 新規。下書き仕訳の作成。読み取れなかった項目は null で保存し、needs_review フラグを立てる
- `src/features/invoice/invoice.repository.ts` — invoice_drafts テーブルの読み書きを追加
- `prisma/schema.prisma` — invoice_drafts テーブルを追加（id, file_url, amount, vendor, issued_on, needs_review, status, created_at）

判断済みの論点:

- OCRは外部API（クラウドOCR）を使い、自前実装しない。APIキーは環境変数
- 認可は既存の requireMember() を流用し、この機能専用の仕組みは作らない
- 元ファイルはオブジェクトストレージに保存し、DBにはURLだけ持つ
- 【要確認】OCR APIの月額上限。超過時に読み取りを止めるか、課金を許容するか

## 4. テスト影響範囲

- 既存の請求書一覧E2E（invoice-list.spec.ts）: 下書きステータスの表示が増えるため、一覧の件数アサーションを更新する
- それ以外の既存テストへの影響はない（新規テーブル・新規エンドポイントのため）

## 5. 新規テストケース

単体（Vitest）:

- 金額の正規化: 「1,234円」「¥1234」「1234.00」→ 1234。不正文字列 → null
- 日付の正規化: 「2026/7/1」「令和8年7月1日」→ "2026-07-01"。不正 → null
- 下書き作成: 3項目すべて読めた場合 needs_review=false、1つでも null なら needs_review=true

E2E（Playwright）:

- 請求書PDFをアップロード → 下書きに金額・取引先・日付が表示される（シナリオ1）
- 読み取れない項目のあるPDF → 該当項目が空欄＋要確認マーク（シナリオ2）
- JPEG以外の画像（PNG） → 受け付けずエラー表示（FR-001の裏）
- 下書きのまま → 仕訳一覧に現れない（FR-002）

## 6. 実装順

1. スキーマ追加と repository（安価なモデルのサブエージェントに委任）
2. 正規化の純粋関数（金額・日付）: 失敗するテスト → 最小実装（同上）
3. ocr.service.ts: OCR API呼び出し。テストはAPIをモックした結合テスト（中核ロジックのため上位モデルで実装）
4. draft.service.ts と controller: 失敗するE2E → 実装（上位モデル）
5. 実装完了後、観点別レビュー3体（セキュリティ・テスト網羅・設計整合）を並列で走らせ、P0/P1を修正

## 7. コミット前テスト実行

- `npx vitest run` — 全単体テスト
- `npx playwright test tests/e2e/invoice-upload.spec.ts tests/e2e/invoice-list.spec.ts` — 新規E2Eと影響のある既存E2E

## 8. スコープ外

- レシート（感熱紙の領収書）の読み取り（要件定義どおり v1 では扱わない）
- 会計ソフトへのエクスポート（既存機能をそのまま使う）
- 読み取り精度のチューニング（まず運用し、誤読の実データを集めてから）
