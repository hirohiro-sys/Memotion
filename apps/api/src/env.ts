import type { NotifySentState } from "./features/notifications/sent-state";

export type Env = {
  // 重複判定の記録（LINE の受信済み、Web の再送）。wrangler.toml のバインディング。
  DEDUP: KVNamespace;
  LINE_CHANNEL_ID: string;
  LINE_CHANNEL_SECRET: string;
  LINE_MESSAGING_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  SESSION_SECRET: string;
  APP_URL: string;
  // Web のログインと LINE の受信を許す LINE ユーザー ID（カンマ区切り）と、その持ち主のアプリのユーザー ID。
  // 許可した全員を APP_USER_ID の 1 人として扱う。どちらかが無ければ誰も許さない。
  ALLOWED_LINE_USER_IDS?: string;
  APP_USER_ID?: string;
  // Notion のインテグレーションのトークンと、メモを書くデータソースの ID。メモの保存先。
  // どちらかが無ければメモを保存できず、通知も送らない。
  NOTION_TOKEN?: string;
  NOTION_DATA_SOURCE_ID?: string;
  // LINE 通知の送信済みの記録。wrangler.toml の Durable Object。
  NOTIFY_STATE: DurableObjectNamespace<NotifySentState>;
  // LINE 通知。送り先は1人。無ければ通知しない。
  NOTIFY_LINE_USER_ID?: string;
  // 通知の時刻（wrangler.toml の vars）。空か無ければその通知はオフ。
  // TECH_WEEKLY は「sun 20:00」、TODO_DAILY と SCHEDULE_DAILY は「08:00」の形。
  TECH_WEEKLY?: string;
  TODO_DAILY?: string;
  SCHEDULE_DAILY?: string;
  // 通知の「他N件」から開く Notion のページ。無ければ APP_URL。
  NOTION_VIEW_URL?: string;
};
