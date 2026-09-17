# Agent Notes

レビュー正本は `.cursor/BUGBOT.md`。見た目は `design.mdc`、認証・LINE・画像は `line-security.mdc`。

## 完了時

`apps/` か `packages/` を変えたら、緑になるまで次を回す。コミットは指示があるまでしない。

```bash
pnpm lint
pnpm typecheck
pnpm --filter @repo/api test
```

- API を触ったら該当 `*.test.ts` も更新する
- Web を触ったら、ブラウザが使えれば変更フローを確認する
- ハーネスや docs だけの変更では上を回さない

## 触らない

- `apps/web/src/routeTree.gen.ts`（TanStack Router の生成物）
- lockfile と `apps/api/migrations/meta` の機械的差分
- `.dev.vars` など秘密情報

契約を変えるときは `packages/shared` を先に直し、API と Web の parse を揃える。
