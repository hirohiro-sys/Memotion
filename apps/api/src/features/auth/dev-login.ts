const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

// 本番の Worker は https の公開ホストで受ける。ループバックの http だけを開発用ログインに使う。
export function devLoginAllowed(input: {
  appUrl: string;
  requestUrl: string;
}): boolean {
  return httpLoopback(input.appUrl) && httpLoopback(input.requestUrl);
}

function httpLoopback(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
