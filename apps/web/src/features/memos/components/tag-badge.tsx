import type { MemoTag } from "@repo/shared";
import { TAG_META } from "@/config/tag-meta";
import { cn } from "@/utils/cn";

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
        "inline-flex items-center rounded-md font-medium",
        meta.className,
        compact ? "px-1.5 py-0.5 text-caption" : "px-3 py-1 text-caption",
      )}
    >
      {meta.label}
    </span>
  );
}
