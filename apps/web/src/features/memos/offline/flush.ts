import type { QueryClient } from "@tanstack/react-query";
import { getStoredUserId } from "@/features/auth/stored-user-id";
import { sendMemo } from "../api/create-memo";
import {
  deleteOutboxItem,
  listOutboxItems,
  markOutboxItemFailed,
} from "./outbox";

export type FlushResult = "done" | "retry" | "unauthorized";

const LOCK_NAME = "memotion-outbox-flush";
const FLUSH_REQUEST_EVENT = "memotion:outbox-flush";

// 未送信リストを書いた順に1件ずつ送る。複数タブで同時に送らないようロックを取る。
export async function flushOutbox(
  queryClient: QueryClient,
): Promise<FlushResult> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, () => sendAll(queryClient));
  }
  return sendAll(queryClient);
}

async function sendAll(queryClient: QueryClient): Promise<FlushResult> {
  const userId = getStoredUserId();
  if (!userId) return "done";

  const items = (await listOutboxItems()).filter(
    (item) => item.status === "pending" && item.userId === userId,
  );

  let saved = false;
  let result: FlushResult = "done";
  try {
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
        saved = true;
        await deleteOutboxItem(item.id);
        continue;
      }
      if (sent.kind === "rejected") {
        // 送り直しても通らない。消さずに「送信できません」として残し、次のメモへ進む。
        await markOutboxItemFailed(item.id);
        continue;
      }
      result = sent.kind;
      break;
    }
  } finally {
    // 途中で未送信リストの操作に失敗しても、保存済みの分は一覧に出す。
    // 再取得はオフラインで止まりうるので、ロックを握ったまま待たない。
    if (saved) void queryClient.invalidateQueries({ queryKey: ["memos"] });
  }
  return result;
}

// メモを積んだ直後など、送信のきっかけを同期の hook に知らせる。
export function requestOutboxFlush() {
  window.dispatchEvent(new Event(FLUSH_REQUEST_EVENT));
}

export function onOutboxFlushRequest(listener: () => void): () => void {
  window.addEventListener(FLUSH_REQUEST_EVENT, listener);
  return () => window.removeEventListener(FLUSH_REQUEST_EVENT, listener);
}
