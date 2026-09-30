# チェックリスト

`docs/dev-flow.md` の 8 step と対になる。導入時、タスクのたび、週次・月次、品質が揺れたときに見る。組織導入は、個人利用のいまは対象外。

## 個別導入

- [ ] Git 管理を敷いた（`git init`、初期コミット、リモート。`.gitignore` に `.env` と `.dev.vars`）
- [ ] `AGENTS.md` に地図を書いた（技術スタック、ディレクトリ構成、主要コマンド、`.cursor/rules/` への誘導）
- [ ] フォルダ構成を AI と相談して決めた（1ファイル1責務。どこに何があるかわかる構成。正本は `.cursor/rules/architecture.mdc`）
- [ ] ルールファイルを置いた。中核はテスト・レビュー・アーキテクチャ（`.cursor/rules/testing.mdc`、`review.mdc`、`architecture.mdc`）。このリポジトリでは加えて `logging.mdc`、`db.mdc`、`design.mdc`、`line-security.mdc`
- [ ] テストが1コマンドで走る（`pnpm --filter @repo/api test`。コマンドは `testing.mdc` と `AGENTS.md` に記載。Playwright はない。Web はブラウザで確認する）
- [ ] 秘密は自分で管理した（ローカルは `apps/api/.dev.vars`。`.gitignore` に `.env` と `.dev.vars`。鍵の値は AI に渡さない。`.cursorignore` で `.dev.vars` を読ませない）

## 毎タスク

- [ ] プランを書いた（`docs/plans/` に8項目。AI に逆質問させてから。形式は `docs/plans/_template.md`。記入例自体は対象にしない）
- [ ] プランをレビューにかけた（観点別。P0 は実装前に反映。プロンプトは `docs/dev-flow.md` の step 2）
- [ ] テストケース一覧に人間がビジネスの目で介入した（機械的な網羅だけで確定しない）
- [ ] 実装はプランを渡すだけにした（口頭の追加要件を足さない）
- [ ] Red を確認してから Green にした（最初から通るテストを疑う）
- [ ] 実装レビューを別セッションで走らせた（`design-reviewer`、`edge-case-reviewer`、`security-reviewer`。P0・P1 がゼロまで。3ラウンドを超えて循環したら人間が裁定する）
- [ ] マージ前に決めたテスト一式を回した（プランの「コミット前テスト実行」。未記載なら `pnpm lint`、`pnpm typecheck`、`pnpm --filter @repo/api test`、`pnpm build`）

## 週次、月次

- [ ] 本番までの X: デプロイ（`pnpm run deploy`。main への push で CI が実行）とログ（`.cursor/rules/logging.mdc` の JSON 1行）までつながっているか。Sentry は入っていない。Workers の設定、D1、R2、Cloudflare の秘密に「コードは問題ないのに動かない」原因が残っていないか
- [ ] テストの信頼性: `.only` / `.skip` と、テスト対象を `vi.mock` で差し替えるごまかしをレビューで潰したか（`.cursor/rules/testing.mdc`）。新しいごまかしの型はルールかスキルに書き足したか
- [ ] 劣化の返済: 同じ失敗の繰り返しが増えたら、コードの劣化を疑う。`docs/dev-flow.md` の step 8（`.cursor/rules/architecture.mdc` に合わせたリファクタ）を止めていないか
- [ ] ルールの鮮度: レビューで同じ指摘が繰り返されたら、`.cursor/rules/` のルールへ昇格させたか

## 品質が揺れたとき（X、Y、F の順に疑う）

- [ ] X: コンテキストは劣化していないか（鮮度、必要十分、一貫性）。長いセッション、古いプラン、矛盾するルールを疑う。入口は `AGENTS.md`、制約は `.cursor/rules/`、実装の根拠は `docs/plans/`
- [ ] Y: テストは信用できるか（骨抜き、スキップ、網羅の穴。`.cursor/rules/testing.mdc`）。緑でも守備範囲の外ではないか。Web の表示と操作は Vitest の外で、ブラウザで確認する
- [ ] F: 最後にモデルの割り当てを疑う（タスクに正解があるか、複雑さに対してモデルが足りているか、並列に値する難所か）。割り当てはプランの実装順に書く

## 組織導入

個人利用のいまは対象外。組織に広げるときに見る。

- [ ] 共通ルールに3領域を定めた（本番・機密への書き込み禁止、破壊的コマンドの自律実行禁止、認証情報の隔離）。このリポジトリでは `AGENTS.md` の触らない、`.cursor/rules/line-security.mdc`、`.cursor/rules/logging.mdc` が個人利用の対応
- [ ] モデルの認可リストを決めた（能力に加えて、学習利用の有無と保持期間）
- [ ] 設定を配布で強制した（Managed Settings。個人の善意に任せない）
- [ ] 3層レビューを CI で機械化した（テストは全コード、AI レビューは全 PR、人間は重要箇所。必須チェックとブランチ保護）。いまの CI（`.github/workflows/ci.yml`）は lint、typecheck、API の Vitest、Web の build まで。AI レビューは CI に入っていない
- [ ] コアと非コアの線を引いた。コアは認証、LINE webhook、画像の認可、メモの削除、ダイジェスト送信（`.cursor/rules/line-security.mdc`）。コアは人間のレビューを必須にする
- [ ] パイロットから始めた（一斉に広げない。うまくいったやり方をテンプレートにして横に広げる）
