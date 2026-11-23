import { getStoredUserId } from "@/features/auth/stored-user-id";
import { sendMemo } from "../api/create-memo";
import {
  deleteOutboxItem,
  listOutboxItems,
  markOutboxItemFailed,
} from "./outbox";

export type FlushResult = {
  status: "done" | "retry" | "unauthorized";
  // この回に保存できた件数。
  saved: number;
};

const LOCK_NAME = "memotion-outbox-flush";
const FLUSH_REQUEST_EVENT = "memotion:outbox-flush";

// 未送信リストを書いた順に1件ずつ送る。複数タブで同時に送らないようロックを取る。
export async function flushOutbox(): Promise<FlushResult> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, sendAll);
  }
  return sendAll();
}

async function sendAll(): Promise<FlushResult> {
  const userId = getStoredUserId();
  if (!userId) return { status: "done", saved: 0 };

  const items = (await listOutboxItems()).filter(
    (item) => item.status === "pending" && item.userId === userId,
  );

  let saved = 0;
  for (const item of items) {
    // 送信の途中で別のユーザーがログインし直したら、前のユーザーのメモを送らない。
    if (getStoredUserId() !== userId) break;
    const sent = await sendMemo({
      id: item.id,
      tag: item.tag,
      content: item.content,
      createdAt: item.createdAt,
    });
    if (sent.kind === "saved") {
      saved += 1;
      await deleteOutboxItem(item.id);
      continue;
    }
    if (sent.kind === "rejected") {
      // 送り直しても通らない。消さずに「送信できません」として残し、次のメモへ進む。
      await markOutboxItemFailed(item.id);
      continue;
    }
    return { status: sent.kind, saved };
  }
  return { status: "done", saved };
}

// メモを積んだ直後など、送信のきっかけを同期の hook に知らせる。
export function requestOutboxFlush() {
  window.dispatchEvent(new Event(FLUSH_REQUEST_EVENT));
}

export function onOutboxFlushRequest(listener: () => void): () => void {
  window.addEventListener(FLUSH_REQUEST_EVENT, listener);
  return () => window.removeEventListener(FLUSH_REQUEST_EVENT, listener);
}
