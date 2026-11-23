// 開発用の Notion のデータソースから、本文が引数と完全に一致するページを読む。
// 値は apps/api/.dev.vars の NOTION_TOKEN と NOTION_DATA_SOURCE_ID。トークンは出さない。
// 出力は本文ごとに1行の JSON（件数、種類、予定日時、入力元）。読むだけで書かない。
//   node .agents/skills/verify-memotion/scripts/notion-read.mjs verify-memotion-0830 ...

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const vars = Object.fromEntries(
  readFileSync(join(root, "apps/api/.dev.vars"), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].trim()]),
);
const token = vars.NOTION_TOKEN;
const dataSourceId = vars.NOTION_DATA_SOURCE_ID;
if (!token || !dataSourceId) {
  console.error(
    "notion-read: NOTION_TOKEN or NOTION_DATA_SOURCE_ID is empty in apps/api/.dev.vars",
  );
  process.exit(1);
}

const titles = process.argv.slice(2);
if (titles.length === 0) {
  console.error("notion-read: pass the exact memo texts to look up");
  process.exit(1);
}

for (const title of titles) {
  const response = await fetch(
    `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2025-09-03",
      },
      body: JSON.stringify({
        filter: { property: "本文", title: { equals: title } },
        page_size: 10,
      }),
    },
  );
  if (!response.ok) {
    console.error(`notion-read: query failed with HTTP ${response.status}`);
    process.exit(1);
  }
  const body = await response.json();
  const pages = body.results.map((page) => ({
    tag: page.properties?.種類?.select?.name ?? null,
    scheduledAt: page.properties?.予定日時?.date?.start ?? null,
    source: page.properties?.入力元?.select?.name ?? null,
  }));
  console.log(JSON.stringify({ content: title, count: pages.length, pages }));
}
