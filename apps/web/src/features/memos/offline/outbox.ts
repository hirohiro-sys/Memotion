import type { MemoTag } from "@repo/shared";

// 送信前のメモを端末の IndexedDB に預ける。アプリを閉じても残り、送信に成功したら消す。
export type OutboxStatus = "pending" | "failed";

export type OutboxItem = {
  id: string;
  userId: string;
  // 予定は日時を持つため、未送信リストに積まない（直接送る）。
  tag: Exclude<MemoTag, "schedule">;
  content: string;
  createdAt: string;
  status: OutboxStatus;
};

const DB_NAME = "memotion";
const DB_VERSION = 1;
const STORE = "outbox";
const CHANNEL = "memotion-outbox";
// iOS では open が応答を返さないことがある。待ち続けて送信やロックが止まらないよう打ち切る。
const OPEN_TIMEOUT_MS = 3_000;

type Listener = () => void;
const listeners = new Set<Listener>();
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(CHANNEL);
channel?.addEventListener("message", () => emitLocal());

function emitLocal() {
  for (const listener of listeners) listener();
}

function notifyChange() {
  emitLocal();
  channel?.postMessage("changed");
}

// 同じタブと他のタブでの変更を購読する。戻り値で解除する。
export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB is not available"));
      return;
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("indexedDB open timed out"));
    }, OPEN_TIMEOUT_MS);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      const db = request.result;
      if (timedOut) {
        db.close();
        return;
      }
      // iOS はバックグラウンドで接続を切ることがある。切れた接続は使い回さない。
      db.onclose = () => forgetDb();
      db.onversionchange = () => {
        db.close();
        forgetDb();
      };
      resolve(db);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
  });
  // 失敗した Promise を使い回さず、次の呼び出しで開き直す。
  dbPromise.catch(() => forgetDb());
  return dbPromise;
}

function forgetDb() {
  dbPromise = null;
}

async function openTransaction(
  mode: IDBTransactionMode,
): Promise<IDBTransaction> {
  const db = await openDb();
  try {
    return db.transaction(STORE, mode);
  } catch {
    // 接続が切れていた（InvalidStateError など）。1回だけ開き直す。
    forgetDb();
    return (await openDb()).transaction(STORE, mode);
  }
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | undefined,
): Promise<T | undefined> {
  const tx = await openTransaction(mode);
  return new Promise<T | undefined>((resolve, reject) => {
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function addOutboxItem(item: OutboxItem): Promise<void> {
  await withStore("readwrite", (store) => store.add(item));
  notifyChange();
}

// 書いた順（createdAt の古い順）に返す。
export async function listOutboxItems(): Promise<OutboxItem[]> {
  const items =
    (await withStore<OutboxItem[]>("readonly", (store) => store.getAll())) ??
    [];
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteOutboxItem(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  notifyChange();
}

// 読み出しと書き込みを1つのトランザクションで行う。間に別タブで消された項目を生き返らせないため。
export async function markOutboxItemFailed(id: string): Promise<void> {
  await withStore("readwrite", (store) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result as OutboxItem | undefined;
      if (item) store.put({ ...item, status: "failed" });
    };
    return undefined;
  });
  notifyChange();
}

export async function clearOutbox(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
  notifyChange();
}

// ログイン中のユーザーと持ち主が違う項目を破棄する。別ユーザーのメモを送らないため。
export async function discardOtherUsersItems(userId: string): Promise<void> {
  const items = await listOutboxItems();
  const others = items.filter((item) => item.userId !== userId);
  if (others.length === 0) return;
  await withStore("readwrite", (store) => {
    for (const item of others) store.delete(item.id);
    return undefined;
  });
  notifyChange();
}
