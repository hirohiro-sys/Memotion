import { useEffect, useState } from "react";
import { getStoredUserId } from "@/features/auth/stored-user-id";
import { listOutboxItems, type OutboxItem, subscribeOutbox } from "./outbox";

const EMPTY: OutboxItem[] = [];

// ログイン中のユーザーの未送信リストを購読する。
export function useOutbox(): OutboxItem[] {
  const [items, setItems] = useState<OutboxItem[]>(EMPTY);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const userId = getStoredUserId();
        const all = await listOutboxItems();
        if (active) setItems(all.filter((item) => item.userId === userId));
      } catch {
        if (active) setItems(EMPTY);
      }
    }
    void load();
    const unsubscribe = subscribeOutbox(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return items;
}
