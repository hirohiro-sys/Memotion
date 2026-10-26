import {
  type CreateMemoRequest,
  createMemoRequestSchema,
  type Memo,
  type MemoTag,
} from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { CloudOff, Inbox, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { getStoredUserId } from "@/features/auth/stored-user-id";
import { AssignToGroupDialog } from "@/features/groups/components/assign-to-group-dialog";
import { cn } from "@/utils/cn";
import { sendMemo } from "../api/create-memo";
import { deleteMemos } from "../api/delete-memos";
import { fetchMemos } from "../api/get-memos";
import { requestOutboxFlush } from "../offline/flush";
import { visiblePendingItems } from "../offline/merge-pending";
import { addOutboxItem, deleteOutboxItem } from "../offline/outbox";
import { useOnlineStatus } from "../offline/use-online-status";
import { useOutbox } from "../offline/use-outbox";
import { MemoCard } from "./memo-card";
import { MemoListSkeleton } from "./memo-card-skeleton";
import { MemoComposer } from "./memo-composer";
import { PendingMemoCard } from "./pending-memo-card";

// 送るあいだに JST の日付が変わり、予定の日付が過去になった（400 schedule_date_past）。
class SchedulePastError extends Error {
  constructor() {
    super("schedule date is past");
    this.name = "SchedulePastError";
  }
}
const EMPTY_MEMOS: Memo[] = [];

export function MemoList() {
  const queryClient = useQueryClient();
  const memosQuery = useQuery({ queryKey: ["memos"], queryFn: fetchMemos });
  const memos = memosQuery.data?.items ?? EMPTY_MEMOS;

  // 選んだタグ。空なら「すべて」。複数選ぶと、どれかに当てはまるメモを出す。
  const [filterTags, setFilterTags] = useState<ReadonlySet<MemoTag>>(new Set());
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const online = useOnlineStatus();
  // オフラインで閉じた「グループに追加」を、オンラインに戻ったときに開き直さない。
  useEffect(() => {
    if (!online) setAssignOpen(false);
  }, [online]);

  const router = useRouter();
  const outboxItems = useOutbox();
  // 送信ボタンの連打で同じメモを2回積まないよう、処理中は受け付けない。
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // 未送信リストが使えない環境と予定で、オンラインのときだけ使う直接送信。
  // 入力が id を持つとき（予定）はそれを使い、送り直しで同じメモを2件作らない。
  const createMutation = useMutation({
    mutationFn: async (input: CreateMemoRequest) => {
      const result = await sendMemo({
        ...input,
        id: input.id ?? crypto.randomUUID(),
        createdAt: input.createdAt ?? new Date().toISOString(),
      });
      if (result.kind === "saved") return;
      if (result.kind === "unauthorized") await router.invalidate();
      if (result.kind === "rejected" && result.code === "schedule_date_past") {
        throw new SchedulePastError();
      }
      throw new Error("failed to create memo");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["memos"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: (error) => {
      toast.add({
        title:
          error instanceof SchedulePastError
            ? "日付が過去になったため保存できませんでした。"
            : "保存できませんでした。",
        type: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMemos,
    onSuccess: async () => {
      setSelectedIds(new Set());
      setConfirmOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["memos"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: async () => {
      setConfirmOpen(false);
      toast.add({ title: "削除できませんでした。", type: "error" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["memos"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
  });

  const busy =
    submitting || createMutation.isPending || deleteMutation.isPending;

  const tagCounts = useMemo(() => {
    const acc: Record<MemoTag, number> = {
      tweet: 0,
      tech: 0,
      other: 0,
      todo: 0,
      schedule: 0,
    };
    for (const memo of memos) acc[memo.tag] += 1;
    return acc;
  }, [memos]);

  const filtered = useMemo(() => {
    let result = memos;
    if (filterTags.size > 0)
      result = result.filter((memo) => filterTags.has(memo.tag));
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (memo) =>
          memo.content.toLowerCase().includes(query) ||
          (memo.url ?? "").toLowerCase().includes(query),
      );
    }
    return result;
  }, [memos, filterTags, search]);

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

  function toggleFilterTag(tag: MemoTag) {
    setFilterTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
    setSelectedIds(new Set());
  }

  function clearFilterTags() {
    setFilterTags(new Set());
    setSelectedIds(new Set());
  }

  function changeSearch(next: string) {
    setSearch(next);
    setSelectedIds(new Set());
  }

  const pendingItems = useMemo(
    () => visiblePendingItems(outboxItems, memos, filterTags, search),
    [outboxItems, memos, filterTags, search],
  );
  // オフラインで取得が止まっている（データが無いまま待機中）。
  const memosOffline =
    memosQuery.data === undefined && memosQuery.fetchStatus === "paused";

  // 送信ボタンを押した時点で端末に保存してから送る。送信の途中で失敗しても、メモは端末に残る。
  async function handleCreate(input: CreateMemoRequest) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await saveAndSend(input);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function saveAndSend(input: CreateMemoRequest) {
    const parsed = createMemoRequestSchema.safeParse(input);
    const userId = getStoredUserId();
    if (!parsed.success) return;

    // 予定は日時を持つので、未送信リストを通さず直接送る。
    // 失敗したら入力欄を閉じず、本文と日時を残す（知らせるのは createMutation の onError）。
    if (parsed.data.tag === "schedule") {
      try {
        await createMutation.mutateAsync(parsed.data);
        setComposing(false);
      } catch {
        // 入力欄に残す。
      }
      return;
    }

    try {
      if (!userId) throw new Error("no stored user");
      await addOutboxItem({
        id: crypto.randomUUID(),
        userId,
        tag: parsed.data.tag,
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
        status: "pending",
      });
    } catch {
      if (!navigator.onLine) {
        toast.add({
          title: "このブラウザではオフラインでの追加が使えません。",
          type: "error",
        });
        return;
      }
      await createMutation.mutateAsync(parsed.data);
      setComposing(false);
      return;
    }
    requestOutboxFlush();
    setComposing(false);
  }

  async function handleDiscard(id: string) {
    try {
      await deleteOutboxItem(id);
    } catch {
      toast.add({ title: "破棄できませんでした。", type: "error" });
    }
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
            onClick={clearFilterTags}
            className={cn(
              PILL_BASE,
              filterTags.size === 0
                ? "bg-foreground text-background"
                : PILL_IDLE,
            )}
          >
            すべて
            <span className="text-caption tabular-nums opacity-60">
              {memos.length}
            </span>
          </button>
          {TAG_ORDER.map((tag) => {
            const meta = TAG_META[tag];
            const active = filterTags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleFilterTag(tag)}
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
                variant="secondary"
                size="xs"
                disabled={busy || !online}
                title={
                  online ? undefined : "オフラインのためグループは使えません"
                }
                onClick={() => setAssignOpen(true)}
              >
                グループに追加
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

      {memosOffline && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-body-sm text-stone">
          <CloudOff className="size-4 shrink-0" />
          オフラインのため既存のメモは表示できません
        </p>
      )}

      {memosQuery.isPending && !memosOffline && <MemoListSkeleton />}

      {memosQuery.isError && (
        <p className="py-20 text-center text-body-sm text-destructive">
          メモの取得に失敗しました
        </p>
      )}

      {memosQuery.isSuccess &&
        filtered.length === 0 &&
        pendingItems.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
            <Inbox className="mx-auto mb-3 size-5 text-stone" />
            <p className="text-body-sm text-stone">
              {search ? "検索結果が見つかりません" : "まだメモがありません"}
            </p>
          </div>
        )}

      <AssignToGroupDialog
        open={assignOpen && online}
        onOpenChange={setAssignOpen}
        ids={selectedList}
        onAssigned={() => setSelectedIds(new Set())}
      />

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

      {(pendingItems.length > 0 ||
        (memosQuery.isSuccess && filtered.length > 0)) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pendingItems.map((item) => (
            <PendingMemoCard
              key={item.id}
              item={item}
              onDiscard={(id) => void handleDiscard(id)}
            />
          ))}
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
