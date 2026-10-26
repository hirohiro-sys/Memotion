import type { GroupMemoTag } from "@repo/shared";
import { ArrowUp } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PILL_BASE, PILL_IDLE, TAG_META, TAG_ORDER } from "@/config/tag-meta";
import { cn } from "@/utils/cn";

// todo と schedule はグループに入れられない。
const GROUP_TAGS = TAG_ORDER.filter(
  (tag): tag is GroupMemoTag => tag !== "todo" && tag !== "schedule",
);
const MAX_ROWS_HEIGHT = 160;

// グループのチャットの入力欄。送信に成功したら本文を消し、失敗（reject）したら残す。
export function GroupMemoInput({
  onSubmit,
}: {
  onSubmit: (input: { tag: GroupMemoTag; content: string }) => Promise<void>;
}) {
  const [tag, setTag] = useState<GroupMemoTag>("tweet");
  const [content, setContent] = useState("");
  // 送信中は同じ本文を重ねて送らない。
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = content.trim().length > 0 && !submitting;

  // 本文に合わせて高さを伸ばす（上限を超えたら中でスクロール）。
  function fitHeight() {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_ROWS_HEIGHT)}px`;
  }

  async function submit() {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit({ tag, content });
      setContent("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch {
      // 呼び出し側が知らせる。本文は残して送り直せるようにする。
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  // Enter は改行。⌘ / Ctrl + Enter で送る（日本語の変換中の Enter では送らない）。
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
      className="border-t border-border bg-card px-3 pt-2.5 pb-3 md:px-4"
    >
      <div className="mb-2 flex items-center gap-1.5">
        {GROUP_TAGS.map((option) => {
          const meta = TAG_META[option];
          const active = tag === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => setTag(option)}
              className={cn(
                PILL_BASE,
                "px-2.5 py-0.5",
                active ? meta.className : PILL_IDLE,
              )}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            fitHeight();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="メモを書く"
          aria-label="メモを書く"
          className="min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 placeholder:text-stone focus:border-primary"
        />
        <Button
          type="submit"
          size="icon-lg"
          disabled={!canSubmit}
          aria-label="送信"
          className="size-10"
        >
          <ArrowUp className="size-5" />
        </Button>
      </div>
      <p className="mt-1.5 hidden text-caption text-stone md:block">
        ⌘ / Ctrl + Enter で送信
      </p>
    </form>
  );
}
