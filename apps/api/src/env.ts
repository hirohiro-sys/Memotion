export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  LINE_CHANNEL_ID: string;
  LINE_CHANNEL_SECRET: string;
  LINE_MESSAGING_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  SESSION_SECRET: string;
  APP_URL: string;
  // Workers AI。wrangler.toml のバインディング。API キーではない。
  AI?: Ai;
};
