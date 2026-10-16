// 前回ログインしたユーザーの ID。オフラインで画面を開く目安と、未送信メモの持ち主の印にだけ使う。
// 認可には使わない（メモの保存・取得の可否は、常にサーバーがセッションで決める）。
const STORAGE_KEY = "memotion_user_id";

export function getStoredUserId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredUserId(userId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, userId);
  } catch {
    // 保存できない環境では、オフライン起動ができないだけで動作は続ける。
  }
}

export function clearStoredUserId() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}
