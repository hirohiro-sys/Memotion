import { Menu } from "@base-ui/react/menu";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const ITEM =
  "flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-body-sm outline-none select-none transition-colors duration-200 data-highlighted:bg-muted";

// グループの見出しの「…」。名前の変更と削除だけを置く。
export function GroupActionsMenu({
  onRename,
  onDelete,
}: {
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="グループの操作"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-stone hover:text-foreground",
        )}
      >
        <Ellipsis />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="min-w-40 rounded-xl border border-border bg-popover p-1 text-popover-foreground outline-none transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Menu.Item
              onClick={onRename}
              className={cn(ITEM, "text-foreground")}
            >
              <Pencil className="size-3.5 text-stone" />
              名前を変更
            </Menu.Item>
            <Menu.Item
              onClick={onDelete}
              className={cn(ITEM, "text-destructive")}
            >
              <Trash2 className="size-3.5" />
              グループを削除
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
