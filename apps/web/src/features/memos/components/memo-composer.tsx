import type { CreateMemoRequest, MemoTag } from "@repo/shared";
import { SendHorizontal } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { PILL_BASE, PILL_IDLE, TAG_META, TAG_ORDER } from "@/config/tag-meta";
import { cn } from "@/utils/cn";
import { useOnlineStatus } from "../offline/use-online-status";

export function MemoComposer({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (input: CreateMemoRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const online = useOnlineStatus();
  const [tag, setTag] = useState<MemoTag>("tweet");
  const [content, setContent] = useState("");
  const canSubmit = content.trim().length > 0 && !busy;

  function submit() {
    if (!canSubmit) return;
    // オフラインでは分類を選ばせず、すべて「つぶやき」で積む。
    return onSubmit({ tag: online ? tag : "tweet", content });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  // Enter は改行。⌘ / Ctrl + Enter は「送信」と同じ（変換中は送らない）。
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
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
        {TAG_ORDER.map((option) => {
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
        onKeyDown={handleKeyDown}
        className="mb-4 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 placeholder:text-stone focus:border-primary"
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          キャンセル
        </Button>
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
