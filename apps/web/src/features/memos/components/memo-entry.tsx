import { type CreateMemoRequest, createMemoRequestSchema } from "@repo/shared";
import { useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { getStoredUserId } from "@/features/auth/stored-user-id";
import { sendMemo } from "../api/create-memo";
import { requestOutboxFlush } from "../offline/flush";
import { addOutboxItem, deleteOutboxItem } from "../offline/outbox";
import { useOutbox } from "../offline/use-outbox";
import { MemoComposer } from "./memo-composer";
import { PendingMemoCard } from "./pending-memo-card";

// メモの投入画面。入力欄と、まだ送れていないメモだけを出す。送ったメモは Notion で見る。
export function MemoEntry() {
  const router = useRouter();
  const outboxItems = useOutbox();
  // 送信ボタンの連打で同じメモを2回積まないよう、処理中は受け付けない。
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(input: CreateMemoRequest): Promise<boolean> {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      return await saveAndSend(input);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // 未送信リストが使えない環境と予定で、オンラインのときだけ使う直接送信。
  // 入力が id を持つとき（予定）はそれを使い、送り直しで同じメモを2件作らない。
  async function sendDirectly(input: CreateMemoRequest): Promise<boolean> {
    const result = await sendMemo({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
    if (result.kind === "saved") {
      toast.add({ title: "保存しました", type: "success" });
      return true;
    }
    if (result.kind === "unauthorized") await router.invalidate();
    toast.add({
      title:
        result.kind === "rejected" && result.code === "schedule_date_past"
          ? "日付が過去になったため保存できませんでした。"
          : "保存できませんでした。",
      type: "error",
    });
    return false;
  }

  // 送信ボタンを押した時点で端末に保存してから送る。送信の途中で失敗しても、メモは端末に残る。
  // 保存の結果は、未送信リストを送る側（useOutboxSync）が知らせる。
  async function saveAndSend(input: CreateMemoRequest): Promise<boolean> {
    const parsed = createMemoRequestSchema.safeParse(input);
    if (!parsed.success) return false;

    // 予定は日時を持つので、未送信リストを通さず直接送る。失敗したら入力を残す。
    if (parsed.data.tag === "schedule") return sendDirectly(parsed.data);

    try {
      const userId = getStoredUserId();
      if (!userId) throw new Error("no stored user");
      await addOutboxItem({
        id: crypto.randomUUID(),
        userId,
        tag: parsed.data.tag,
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
        status: "pending",
      });
    } catch {
      if (!navigator.onLine) {
        toast.add({
          title: "このブラウザではオフラインでの追加が使えません。",
          type: "error",
        });
        return false;
      }
      return sendDirectly(parsed.data);
    }
    requestOutboxFlush();
    return true;
  }

  async function handleDiscard(id: string) {
    try {
      await deleteOutboxItem(id);
    } catch {
      toast.add({ title: "破棄できませんでした。", type: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <MemoComposer busy={submitting} onSubmit={handleSubmit} />

      {outboxItems.length > 0 && (
        <section aria-label="未送信のメモ" className="space-y-3">
          <h2 className="text-caption font-medium text-stone">
            未送信のメモ {outboxItems.length}件
          </h2>
          {outboxItems.map((item) => (
            <PendingMemoCard
              key={item.id}
              item={item}
              onDiscard={(id) => void handleDiscard(id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
