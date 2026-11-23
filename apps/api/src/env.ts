export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  // 重複判定の記録（LINE の受信済み、Web の再送）。wrangler.toml のバインディング。
  DEDUP: KVNamespace;
  LINE_CHANNEL_ID: string;
  LINE_CHANNEL_SECRET: string;
  LINE_MESSAGING_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  SESSION_SECRET: string;
  APP_URL: string;
  // Notion のインテグレーションのトークンと、メモを書くデータソースの ID。
  // どちらかが無ければ Notion には書かない（D1 への保存は続ける）。
  NOTION_TOKEN?: string;
  NOTION_DATA_SOURCE_ID?: string;
  // Workers AI。wrangler.toml のバインディング。API キーではない。
  AI?: Ai;
};
