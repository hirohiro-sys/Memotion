import type { CreateMemoRequest, MemoTag } from "@repo/shared";
import { SendHorizontal } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { PILL_BASE, PILL_IDLE, TAG_META, TAG_ORDER } from "@/lib/tag-meta";
import { cn } from "@/lib/utils";

export function MemoComposer({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (input: CreateMemoRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [tag, setTag] = useState<MemoTag | null>(null);
  const [content, setContent] = useState("");
  const canSubmit = tag !== null && content.trim().length > 0 && !busy;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!tag || content.trim().length === 0) return;
    await onSubmit({ tag, content });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-border bg-card p-6"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
