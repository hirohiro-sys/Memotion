import type { CreateMemoRequest, Memo, MemoTag } from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PILL_BASE, PILL_IDLE, TAG_META, TAG_ORDER } from "@/config/tag-meta";
import { cn } from "@/utils/cn";
import { createMemo } from "../api/create-memo";
import { deleteMemos } from "../api/delete-memos";
import { fetchMemos } from "../api/get-memos";
import { MemoCard } from "./memo-card";
import { MemoListSkeleton } from "./memo-card-skeleton";
import { MemoComposer } from "./memo-composer";

type FilterTag = MemoTag | "all";
const EMPTY_MEMOS: Memo[] = [];

export function MemoList() {
  const queryClient = useQueryClient();
  const memosQuery = useQuery({ queryKey: ["memos"], queryFn: fetchMemos });
  const memos = memosQuery.data?.items ?? EMPTY_MEMOS;

  const [filter, setFilter] = useState<FilterTag>("all");
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: createMemo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
    },
    onError: () => {
      toast.add({ title: "保存できませんでした。", type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMemos,
    onSuccess: async () => {
      setSelectedIds(new Set());
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
    },
    onError: async () => {
      setConfirmOpen(false);
      toast.add({ title: "削除できませんでした。", type: "error" });
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
    },
  });

  const busy = createMutation.isPending || deleteMutation.isPending;

  const tagCounts = useMemo(() => {
    const acc: Record<MemoTag, number> = {
      tweet: 0,
      tech: 0,
      other: 0,
      todo: 0,
    };
    for (const memo of memos) acc[memo.tag] += 1;
    return acc;
  }, [memos]);

  const filtered = useMemo(() => {
    let result = memos;
    if (filter !== "all") result = result.filter((memo) => memo.tag === filter);
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (memo) =>
          memo.content.toLowerCase().includes(query) ||
          (memo.url ?? "").toLowerCase().includes(query),
      );
    }
    return result;
  }, [memos, filter, search]);

  const selectedList = useMemo(
    () => filtered.filter((memo) => selectedIds.has(memo.id)).map((m) => m.id),
    [filtered, selectedIds],
  );

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeFilter(next: FilterTag) {
    setFilter(next);
    setSelectedIds(new Set());
  }

  function changeSearch(next: string) {
    setSearch(next);
    setSelectedIds(new Set());
  }

  async function handleCreate(input: CreateMemoRequest) {
    await createMutation.mutateAsync(input);
    setComposing(false);
  }

  return (
    <div className="mx-auto max-w-[1440px] p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-stone" />
            <input
              type="search"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="メモを検索"
              className="w-full rounded-lg border border-border bg-card py-2 pr-8 pl-9 text-body-sm text-foreground outline-none transition-colors duration-200 placeholder:text-stone focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => changeSearch("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-stone transition-colors duration-200 hover:text-foreground"
                aria-label="検索をクリア"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            disabled={busy || composing}
            onClick={() => setComposing(true)}
            aria-label="追加"
            className="size-10  text-foreground hover:bg-foreground/8"
          >
            <Plus className="size-6" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => changeFilter("all")}
            className={cn(
              PILL_BASE,
              filter === "all" ? "bg-foreground text-background" : PILL_IDLE,
            )}
          >
            すべて
            <span className="text-caption tabular-nums opacity-60">
              {memos.length}
            </span>
          </button>
          {TAG_ORDER.map((tag) => {
            const meta = TAG_META[tag];
            const active = filter === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => changeFilter(tag)}
                className={cn(PILL_BASE, active ? meta.className : PILL_IDLE)}
              >
                {meta.label}
                <span className="text-caption tabular-nums opacity-60">
                  {tagCounts[tag]}
                </span>
              </button>
            );
          })}
          {selectedList.length > 0 && (
            <div className="ml-auto flex items-center gap-3 text-body-sm">
              <span className="text-graphite tabular-nums">
                {selectedList.length}件選択中
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={() => setSelectedIds(new Set())}
              >
                選択解除
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                disabled={busy}
                onClick={() => setConfirmOpen(true)}
              >
                削除
              </Button>
            </div>
          )}
        </div>
      </div>

      {composing && (
        <MemoComposer
          busy={busy}
          onSubmit={handleCreate}
          onCancel={() => setComposing(false)}
        />
      )}

      {memosQuery.isPending && <MemoListSkeleton />}

      {memosQuery.isError && (
        <p className="py-20 text-center text-body-sm text-destructive">
          メモの取得に失敗しました
        </p>
      )}

      {memosQuery.isSuccess && filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Inbox className="mx-auto mb-3 size-5 text-stone" />
          <p className="text-body-sm text-stone">
            {search ? "検索結果が見つかりません" : "まだメモがありません"}
          </p>
        </div>
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!deleteMutation.isPending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {selectedList.length}件のメモを削除しますか？
          </AlertDialogTitle>
          <AlertDialogDescription>
            削除したメモは元に戻せません。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button type="button" variant="ghost" size="sm" />}
              disabled={deleteMutation.isPending}
            >
              キャンセル
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(selectedList)}
            >
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {memosQuery.isSuccess && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              busy={busy}
              selected={selectedIds.has(memo.id)}
              onToggle={toggleSelected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
