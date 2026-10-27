import type { Memo } from "@repo/shared";
import { NotebookPen } from "lucide-react";
import { TagBadge } from "@/features/memos/components/tag-badge";
import { jstClock } from "../jst";

// 選んだ日に書いたメモ（予定以外）。見るだけで、編集と削除はメモタブで行う。
export function DayMemoList({ memos }: { memos: Memo[] }) {
  return (
    <div className="mt-6 border-t border-border pt-6">
      <h3 className="mb-4 text-body font-medium text-foreground">
        この日のメモ
      </h3>
      {memos.length === 0 ? (
        <div className="py-8 text-center">
          <NotebookPen className="mx-auto mb-2 size-5 text-stone" />
          <p className="text-body-sm text-stone">
            この日に書いたメモはありません
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {memos.map((memo) => (
            <li key={memo.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="w-12 shrink-0 pt-0.5 text-caption font-medium text-stone tabular-nums">
                {jstClock(new Date(memo.createdAt))}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1">
                  <TagBadge tag={memo.tag} size="xs" />
                </div>
                <p className="line-clamp-3 break-words whitespace-pre-wrap text-body-sm text-graphite">
                  {memo.content}
                </p>
                {memo.thumbnailUrl ? (
                  <img
                    src={memo.thumbnailUrl}
                    alt=""
                    className="mt-2 h-16 w-24 rounded-lg object-cover"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
