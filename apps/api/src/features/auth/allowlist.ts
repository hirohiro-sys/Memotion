// ログインと LINE の受信を許す LINE ユーザーと、その持ち主のアプリのユーザー ID を、環境変数から決める。
// 許可した LINE ユーザーは全員、APP_USER_ID の 1 人として扱う（個人用のため）。

// LINE ユーザー ID はカンマ区切り。前後の空白と空の要素は無視する。
export function parseAllowedLineUserIds(
  value: string | undefined,
): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
}

// 許可した LINE ユーザーなら持ち主の ID、そうでなければ null。
// 持ち主の ID が無いときは、誰も許可しない（設定の漏れで別の ID に保存しない）。
export function appUserIdFor(input: {
  allowedLineUserIds: string | undefined;
  appUserId: string | undefined;
  lineUserId: string;
}): string | null {
  const appUserId = input.appUserId?.trim();
  if (!appUserId) return null;
  return parseAllowedLineUserIds(input.allowedLineUserIds).has(input.lineUserId)
    ? appUserId
    : null;
}
