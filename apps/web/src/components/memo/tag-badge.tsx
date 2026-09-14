import type { MemoTag } from "@repo/shared";
import { TAG_META } from "@/lib/tag-meta";
import { cn } from "@/lib/utils";

export function TagBadge({
  tag,
  size = "sm",
}: {
  tag: MemoTag;
  size?: "sm" | "xs";
}) {
  const meta = TAG_META[tag];
  const compact = size === "xs";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        meta.className,
        compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-caption",
      )}
    >
      {meta.label}
    </span>
  );
}
