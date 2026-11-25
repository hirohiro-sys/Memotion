import type { Env } from "../../env";
import { createPage, queryDataSource } from "../../lib/notion/client";
import { buildNotionPage, type NotionMemo } from "./notion-page";
import {
  memoIdQueryBody,
  type NotionListedMemo,
  toNotionListedMemo,
} from "./notion-query";

// メモの保存先である Notion の読み書き。メモの保存先は Notion だけ。

export type NotionEnv = Pick<Env, "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID">;

type NotionSecrets = { token: string; dataSourceId: string };

function logJson(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

function secretsOf(env: NotionEnv): NotionSecrets | null {
  if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) return null;
  return { token: env.NOTION_TOKEN, dataSourceId: env.NOTION_DATA_SOURCE_ID };
}

// 同じメモIDのページが Notion にあるか。読めなければ null。
async function findNotionPage(
  secrets: NotionSecrets,
  memoId: string,
): Promise<boolean | null> {
  const result = await queryDataSource({
    ...secrets,
    body: memoIdQueryBody(memoId),
  });
  return result.ok ? result.results.length > 0 : null;
}

// 書き込みの結果が分からない失敗（ネットワーク、5xx）。Notion は 503 でも保存していることがある。
function isAmbiguousFailure(status: number): boolean {
  return status === 0 || status >= 500;
}

export type NotionSaveResult = { ok: true; created: boolean } | { ok: false };

// メモを Notion のページにする。
// checkFirst のときは、先に同じメモIDのページを探し、あれば作らない（Web の再送）。
// 結果が分からない失敗のあとも、メモIDで探して保存済みかを確かめる。
export async function saveMemoToNotion(
  env: NotionEnv,
  memo: NotionMemo,
  options: { checkFirst: boolean },
): Promise<NotionSaveResult> {
  const secrets = secretsOf(env);
  if (!secrets) {
    logJson({
      event: "memo.notion",
      status: "skipped",
      reason: "no_secret",
      memoId: memo.id,
    });
    return { ok: false };
  }

  if (options.checkFirst && (await findNotionPage(secrets, memo.id))) {
    logJson({ event: "memo.notion", status: "duplicate", memoId: memo.id });
    return { ok: true, created: false };
  }

  const result = await createPage({
    token: secrets.token,
    body: buildNotionPage(memo, secrets.dataSourceId),
  });
  if (result.ok) return { ok: true, created: true };

  if (
    isAmbiguousFailure(result.status) &&
    (await findNotionPage(secrets, memo.id))
  ) {
    return { ok: true, created: true };
  }
  logJson({
    event: "memo.notion",
    status: "failed",
    httpStatus: result.status,
    memoId: memo.id,
  });
  return { ok: false };
}

// 1回の読み込みで読むのは最大 5 ページ（500 件）まで。
const NOTION_MAX_PAGES = 5;

// truncated は、読める上限で打ち切ったとき true。
export type NotionMemoList =
  | { ok: true; memos: NotionListedMemo[]; truncated: boolean }
  | { ok: false; reason: "no_secret" }
  | { ok: false; reason: "upstream"; httpStatus: number };

// bodyFor が返す検索条件でメモを読む。続きがあればカーソルで次のページを読む。
export async function queryNotionMemos(
  env: NotionEnv,
  bodyFor: (cursor?: string) => unknown,
): Promise<NotionMemoList> {
  const secrets = secretsOf(env);
  if (!secrets) return { ok: false, reason: "no_secret" };
  const memos: NotionListedMemo[] = [];
  let cursor: string | undefined;
  let truncated = false;
  for (let page = 0; page < NOTION_MAX_PAGES; page += 1) {
    const result = await queryDataSource({ ...secrets, body: bodyFor(cursor) });
    if (!result.ok) {
      return { ok: false, reason: "upstream", httpStatus: result.status };
    }
    for (const item of result.results) {
      const memo = toNotionListedMemo(item);
      if (memo) memos.push(memo);
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
    truncated = page === NOTION_MAX_PAGES - 1;
  }
  return { ok: true, memos, truncated };
}
