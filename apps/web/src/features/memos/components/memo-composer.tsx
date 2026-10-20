import type { CreateMemoRequest, MemoTag } from "@repo/shared";
import { SendHorizontal } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PILL_BASE, PILL_IDLE, TAG_META, TAG_ORDER } from "@/config/tag-meta";
import { cn } from "@/utils/cn";
import { useOnlineStatus } from "../offline/use-online-status";

export function MemoComposer({
  busy,
  onSubmit,
  onCancel,
  tags = TAG_ORDER,
  clearOnSubmit = false,
}: {
  busy: boolean;
  onSubmit: (input: CreateMemoRequest) => Promise<void>;
  // 無いときは「キャンセル」を出さない（入力欄を常に表示する画面）。
  onCancel?: () => void;
  // 選べるタグ。先頭が初期値。
  tags?: MemoTag[];
  // onSubmit が成功したら本文を消す。失敗（reject）したら本文を残す。
  clearOnSubmit?: boolean;
}) {
  const online = useOnlineStatus();
  const [tag, setTag] = useState<MemoTag>(tags[0] ?? "tweet");
  const [content, setContent] = useState("");
  // 送信中は、親の busy が戻る前でも同じ本文を重ねて送らない。
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const canSubmit = content.trim().length > 0 && !busy && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (content.trim().length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await submit();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function submit() {
    // オフラインでは分類を選ばせず、すべて「つぶやき」で積む。
    const input = { tag: online ? tag : "tweet", content } as const;
    if (!clearOnSubmit) {
      await onSubmit(input);
      return;
    }
    try {
      await onSubmit(input);
    } catch {
      return;
    }
    setContent("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-border bg-card p-6"
    >
      {online ? null : (
        <p className="mb-4 text-caption text-stone">
          オフラインです。メモは「つぶやき」として保存し、オンラインに戻ると自動で送信します。
        </p>
      )}
      <div
        className={cn(
          "mb-4 flex flex-wrap items-center gap-2",
          !online && "hidden",
        )}
      >
        {tags.map((option) => {
          const meta = TAG_META[option];
          const active = tag === option;
          return (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => setTag(option)}
              className={cn(PILL_BASE, active ? meta.className : PILL_IDLE)}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="メモを入力..."
        rows={3}
        className="mb-4 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 placeholder:text-stone focus:border-primary"
      />

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            キャンセル
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="outline"
          size="icon"
          disabled={!canSubmit}
          aria-label="送信"
          className="border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </form>
  );
}
