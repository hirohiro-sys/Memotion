import { Menu } from "@base-ui/react/menu";
import {
  type ChangeableMemoTag,
  changeableMemoTagSchema,
  type Memo,
} from "@repo/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { TAG_META, TAG_ORDER } from "@/config/tag-meta";
import { cn } from "@/utils/cn";
import { ChangeMemoTagError, changeMemoTag } from "../api/change-memo-tag";
import { useOnlineStatus } from "../offline/use-online-status";

const CHANGEABLE_TAGS = TAG_ORDER.filter(
  (tag): tag is ChangeableMemoTag =>
    changeableMemoTagSchema.safeParse(tag).success,
);

const ITEM =
  "flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-body-sm outline-none select-none transition-colors duration-200 data-highlighted:bg-muted";

// カードのタグ表示。押すとタグを付け直すメニューが開く。予定への変更は「予定にする」が受け持つ。
export function TagChangeMenu({ memo, busy }: { memo: Memo; busy: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const online = useOnlineStatus();
  const [submitting, setSubmitting] = useState(false);
  const meta = TAG_META[memo.tag];

  async function handleSelect(tag: ChangeableMemoTag) {
    if (tag === memo.tag || submitting) return;
    setSubmitting(true);
    try {
      await changeMemoTag(memo.id, tag);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["memos"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    } catch (error) {
      if (error instanceof ChangeMemoTagError) {
        if (error.status === 401) {
          await router.invalidate();
          return;
        }
        if (error.code === "memo_tag_not_changeable" || error.status === 404) {
          toast.add({
            title: "このメモのタグは変えられません。",
            type: "error",
          });
          await queryClient.invalidateQueries({ queryKey: ["memos"] });
          return;
        }
      }
      toast.add({ title: "保存できませんでした。", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={busy || !online || submitting}
        aria-label={`タグを変更（現在: ${meta.label}）`}
        title={online ? undefined : "オフラインのため使えません"}
        className={cn(
          "inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-0.5 text-caption font-medium transition-opacity duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60",
          meta.className,
        )}
      >
        {meta.label}
        <ChevronDown className="size-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={6} className="z-50">
          <Menu.Popup className="min-w-40 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-pop outline-none transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0">
            {CHANGEABLE_TAGS.map((tag) => (
              <Menu.Item
                key={tag}
                onClick={() => void handleSelect(tag)}
                className={cn(ITEM, "text-foreground")}
              >
                <span className="flex-1">{TAG_META[tag].label}</span>
                {tag === memo.tag ? (
                  <Check className="size-3.5 text-stone" />
                ) : null}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
