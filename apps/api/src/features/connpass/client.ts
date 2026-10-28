import type { ConnpassEvent } from "./plan";

const BASE_URL = "https://connpass.com/api/v2";
const PAGE_SIZE = 100;
// 1000 件まで。これで足りなければ「途中で切れた」として扱う。
const MAX_PAGES = 10;
// connpass は 1 キーにつき 1 秒に 1 リクエストまで。
const REQUEST_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 10_000;
// connpass は User-Agent が無いリクエストを 403 で弾く（Workers の fetch は既定で付けない）。
const USER_AGENT = "Memotion (personal journaling tool)";
// 1 回の取り込みに使う時間の上限。手動の間隔（60 秒）より短くして、取り込み同士が重ならないようにする。
// 超えたら、それまでに取れた分で「途中で切れた」として終える。
const FETCH_BUDGET_MS = 45_000;
// 開催日時はタイムゾーン付きだけを読む。付いていない値は、どの時刻か分からないので形が合わないものとして扱う。
const OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

const OPEN_STATUSES = ["preopen", "open", "close", "cancelled"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEvent(value: unknown): ConnpassEvent | null {
  if (!isRecord(value)) return null;
  const { id, title, started_at: startedAt, open_status: openStatus } = value;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  if (typeof title !== "string") return null;
  if (startedAt !== null && typeof startedAt !== "string") return null;
  if (
    typeof startedAt === "string" &&
    (!OFFSET_PATTERN.test(startedAt) || Number.isNaN(Date.parse(startedAt)))
  ) {
    return null;
  }
  const status = OPEN_STATUSES.find((candidate) => candidate === openStatus);
  if (status === undefined) return null;
  return { id, title, startedAt, openStatus: status };
}

// 1件でも形が合わなければ、ページ全体を失敗にする（null を返す）。
function parseEventsPage(
  body: unknown,
): { available: number; events: ConnpassEvent[] } | null {
  if (!isRecord(body)) return null;
  const available = body.results_available;
  if (typeof available !== "number" || !Number.isInteger(available)) {
    return null;
  }
  if (available < 0 || !Array.isArray(body.events)) return null;
  // 1ページは count（100）件まで。それを超える応答は、形が合わないものとして扱う。
  if (body.events.length > PAGE_SIZE) return null;
  const events: ConnpassEvent[] = [];
  for (const item of body.events) {
    const event = parseEvent(item);
    if (event === null) return null;
    events.push(event);
  }
  return { available, events };
}

function parseUserNicknames(body: unknown): string[] | null {
  if (!isRecord(body) || !Array.isArray(body.users)) return null;
  const nicknames: string[] = [];
  for (const user of body.users) {
    if (!isRecord(user) || typeof user.nickname !== "string") return null;
    nicknames.push(user.nickname);
  }
  return nicknames;
}

export type FetchEventsResult =
  | { status: "ok"; events: ConnpassEvent[]; complete: boolean; pages: number }
  | { status: "failed"; httpStatus?: number };

export type UserExistsResult =
  // exists のとき、connpass が返した正式なユーザー名（大文字小文字は connpass の表記）。
  | { status: "ok"; exists: true; nickname: string }
  | { status: "ok"; exists: false }
  | { status: "failed"; httpStatus?: number };

export type ClientDeps = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type GetResult =
  | { ok: true; body: unknown }
  | { ok: false; httpStatus?: number };

// 宛先は connpass の API に固定する。リダイレクトは追わない。
async function getJson(
  apiKey: string,
  path: string,
  params: URLSearchParams,
  doFetch: typeof fetch,
): Promise<GetResult> {
  try {
    const response = await doFetch(`${BASE_URL}${path}?${params.toString()}`, {
      headers: { "X-API-Key": apiKey, "User-Agent": USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, httpStatus: response.status };
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false };
  }
}

// 指定したユーザーが参加しているイベントを、指定した月（yyyymm）の分だけ取る。
// どれかのページが失敗したら全体を失敗にする（途中までの結果は返さない）。
export async function fetchAttendedEvents(
  input: { apiKey: string; nickname: string; months: string[] },
  deps: ClientDeps = {},
): Promise<FetchEventsResult> {
  if (input.apiKey.trim() === "") return { status: "failed" };
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const events: ConnpassEvent[] = [];
  let pages = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (page > 0) {
      if (now() - startedAt >= FETCH_BUDGET_MS) break;
      await sleep(REQUEST_INTERVAL_MS);
    }
    const params = new URLSearchParams();
    params.append("nickname", input.nickname);
    for (const month of input.months) params.append("ym", month);
    params.set("order", "2");
    params.set("count", String(PAGE_SIZE));
    params.set("start", String(events.length + 1));

    const result = await getJson(input.apiKey, "/events/", params, doFetch);
    if (!result.ok) return { status: "failed", httpStatus: result.httpStatus };
    const parsed = parseEventsPage(result.body);
    if (parsed === null) return { status: "failed" };

    pages += 1;
    events.push(...parsed.events);
    if (events.length >= parsed.available) {
      return { status: "ok", events, complete: true, pages };
    }
    // 件数が残っているのに空のページが返った。ここまでを「途中で切れた」として扱う。
    if (parsed.events.length === 0) break;
  }
  return { status: "ok", events, complete: false, pages };
}

// connpass にそのユーザー名があるか。保存の前に、打ち間違いを弾くために使う。
export async function checkUserExists(
  input: { apiKey: string; nickname: string },
  deps: ClientDeps = {},
): Promise<UserExistsResult> {
  if (input.apiKey.trim() === "") return { status: "failed" };
  const doFetch = deps.fetch ?? fetch;
  const params = new URLSearchParams({ nickname: input.nickname });
  const result = await getJson(input.apiKey, "/users/", params, doFetch);
  if (!result.ok) return { status: "failed", httpStatus: result.httpStatus };
  const nicknames = parseUserNicknames(result.body);
  if (nicknames === null) return { status: "failed" };
  const wanted = input.nickname.toLowerCase();
  const matched = nicknames.find(
    (nickname) => nickname.toLowerCase() === wanted,
  );
  return matched === undefined
    ? { status: "ok", exists: false }
    : { status: "ok", exists: true, nickname: matched };
}
