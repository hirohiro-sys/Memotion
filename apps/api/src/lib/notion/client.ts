// Notion API の呼び出し。トークンと応答の本文は呼び出し側に返さず、ログにも出さない。

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
