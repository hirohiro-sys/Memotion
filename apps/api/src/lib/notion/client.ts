// Notion API の呼び出し。トークンは呼び出し側に返さず、ログにも出さない。
// ページの作成は応答の本文を読まずに捨てる。データソースの検索は結果のページだけを返す。

const PAGES_URL = "https://api.notion.com/v1/pages";
// data_source_id を親にできる最初の版。新しい版に上げるときは移行ガイドを読んでから。
export const NOTION_VERSION = "2025-09-03";

// status はネットワークの失敗で 0。
export type CreatePageResult = { ok: true } | { ok: false; status: number };

export async function createPage(input: {
  token: string;
  body: unknown;
}): Promise<CreatePageResult> {
  try {
    const response = await fetch(PAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify(input.body),
    });
    if (response.ok) return { ok: true };
    return { ok: false, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

const DATA_SOURCES_URL = "https://api.notion.com/v1/data_sources";

// 結果のページは、呼び出し側が必要なプロパティだけを読む。status はネットワークの失敗で 0。
export type QueryDataSourceResult =
  | { ok: true; results: unknown[]; nextCursor: string | null }
  | { ok: false; status: number };

function readQueryBody(
  body: unknown,
): { results: unknown[]; nextCursor: string | null } | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.results)) return null;
  const nextCursor =
    record.has_more === true && typeof record.next_cursor === "string"
      ? record.next_cursor
      : null;
  return { results: record.results, nextCursor };
}

// データソースのページを、フィルタで1ページ分（最大100件）取る。
// 応答の形が読めないときは、HTTP の状態を付けて失敗にする。
export async function queryDataSource(input: {
  token: string;
  dataSourceId: string;
  body: unknown;
}): Promise<QueryDataSourceResult> {
  try {
    const response = await fetch(
      `${DATA_SOURCES_URL}/${encodeURIComponent(input.dataSourceId)}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION,
        },
        body: JSON.stringify(input.body),
      },
    );
    if (!response.ok) return { ok: false, status: response.status };
    const parsed = readQueryBody(await response.json());
    if (!parsed) return { ok: false, status: response.status };
    return { ok: true, ...parsed };
  } catch {
    return { ok: false, status: 0 };
  }
}
