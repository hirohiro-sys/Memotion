import type { Group, GroupListResponse, GroupMemoTag } from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/utils/cn";
import { createGroupMemo } from "../api/create-group-memo";
import { deleteGroup } from "../api/delete-group";
import {
  DuplicateGroupNameError,
  GroupNotFoundError,
  UnauthorizedError,
} from "../api/errors";
import { fetchGroupMemos } from "../api/get-group-memos";
import { renameGroup } from "../api/rename-group";
import { toDaySections } from "../day-sections";
import { invalidateAfterGroupWrite } from "../invalidate";
import { useIsDesktop } from "../use-is-desktop";
import {
  markGroupHandled,
  useLeaveMissingGroup,
} from "../use-leave-missing-group";
import { GroupActionsMenu } from "./group-actions-menu";
import { GroupMemoInput } from "./group-memo-input";
import { GroupNameDialog } from "./group-name-dialog";
import { MemoBubble } from "./memo-bubble";

// グループの中身。チャットのように古いメモを上、新しいメモを下に並べ、下の入力欄から書き足す。
export function GroupChat({ group }: { group: Group }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const leaveMissingGroup = useLeaveMissingGroup();
  const isDesktop = useIsDesktop();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 失敗した本文をそのまま送り直すときは同じ id を使う（応答だけ切れて保存済みなら、サーバーが既存として返す）。
  const pendingRef = useRef<{ tag: string; content: string; id: string }>(null);

  const memosQuery = useQuery({
    queryKey: ["groups", group.id, "memos"],
    queryFn: () => fetchGroupMemos(group.id),
    // グループが無いと分かったら、再試行せずにすぐ一覧へ戻す。
    retry: (failureCount, error) =>
      !(error instanceof GroupNotFoundError) && failureCount < 3,
  });
  const memos = memosQuery.data?.items;
  const memoCount = memos?.length ?? group.memoCount;
  const sections = useMemo(
    () => (memos ? toDaySections(memos, new Date()) : []),
    [memos],
  );

  useEffect(() => {
    if (memosQuery.error instanceof GroupNotFoundError) {
      leaveMissingGroup(group.id);
    }
  }, [memosQuery.error, group.id, leaveMissingGroup]);

  // 開いたときと、メモが増えたときは、いちばん新しいメモ（下端）を見せる。
  const lastMemoId = sections.at(-1)?.memos.at(-1)?.id;
  useLayoutEffect(() => {
    if (!lastMemoId) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lastMemoId]);

  const createMutation = useMutation({
    mutationFn: (input: { tag: GroupMemoTag; content: string }) => {
      const pending = pendingRef.current;
      const id =
        pending?.tag === input.tag && pending.content === input.content
          ? pending.id
          : crypto.randomUUID();
      pendingRef.current = { ...input, id };
      return createGroupMemo(group.id, {
        ...input,
        id,
        createdAt: new Date().toISOString(),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(group.id),
  });

  // 失敗したら reject して、入力欄に本文を残す。
  async function handleCreate(input: { tag: GroupMemoTag; content: string }) {
    try {
      await createMutation.mutateAsync(input);
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        leaveMissingGroup(group.id);
      } else if (error instanceof UnauthorizedError) {
        await router.invalidate();
      } else {
        toast.add({ title: "保存できませんでした。", type: "error" });
      }
      throw error;
    }
    pendingRef.current = null;
    // 取り直しを待たずに返し、入力欄の本文をすぐ消す（待つ間に同じ本文を送れないように）。
    void invalidateAfterGroupWrite(queryClient);
  }

  async function handleRename(name: string) {
    try {
      await renameGroup(group.id, name);
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        setRenameOpen(false);
        leaveMissingGroup(group.id);
      } else if (!(error instanceof DuplicateGroupNameError)) {
        toast.add({ title: "変更できませんでした。", type: "error" });
      }
      throw error;
    }
    await queryClient.invalidateQueries({ queryKey: ["groups"] });
    setRenameOpen(false);
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      setDeleteOpen(false);
      if (error instanceof GroupNotFoundError) {
        leaveMissingGroup(group.id);
      } else {
        toast.add({ title: "削除できませんでした。", type: "error" });
      }
      return;
    }
    setDeleteOpen(false);
    markGroupHandled(group.id);
    // 一覧の自動で開く処理が、取り直す前の一覧に残る削除済みのグループを開かないよう、先にキャッシュから外す。
    queryClient.setQueryData<GroupListResponse>(["groups"], (current) =>
      current
        ? { items: current.items.filter((item) => item.id !== group.id) }
        : current,
    );
    const next = queryClient.getQueryData<GroupListResponse>(["groups"])
      ?.items[0];
    // 「戻る」で削除済みのグループに戻らないよう、URL を置き換える。
    await navigate({
      to: "/",
      search:
        isDesktop && next
          ? { view: "groups", group: next.id }
          : { view: "groups" },
      replace: true,
    });
    queryClient.removeQueries({ queryKey: ["groups", group.id, "memos"] });
    await invalidateAfterGroupWrite(queryClient);
  }

  return (
    <section
      aria-label={group.name}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background md:rounded-xl md:border md:border-border"
    >
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 md:px-4">
        <Link
          to="/"
          search={{ view: "groups" }}
          aria-label="グループ一覧に戻る"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "-ml-1 text-stone hover:text-foreground md:hidden",
          )}
        >
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body font-semibold text-foreground">
            {group.name}
          </h2>
          <p className="text-caption tabular-nums text-stone">
            メモ {memoCount}件
          </p>
        </div>
        <GroupActionsMenu
          onRename={() => setRenameOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6"
      >
        {memosQuery.isPending ? (
          <div className="flex flex-col items-end gap-4">
            <Skeleton className="h-12 w-2/3 rounded-xl" />
            <Skeleton className="h-20 w-1/2 rounded-xl" />
            <Skeleton className="h-12 w-3/5 rounded-xl" />
          </div>
        ) : null}

        {memosQuery.isError &&
        !(memosQuery.error instanceof GroupNotFoundError) ? (
          <p className="py-20 text-center text-body-sm text-destructive">
            メモの取得に失敗しました
          </p>
        ) : null}

        {memos && memos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <MessageSquareText className="mb-3 size-5 text-stone" />
            <p className="text-body-sm text-foreground">まだメモがありません</p>
            <p className="mt-1 text-caption text-stone">
              下の入力欄から、この作業のメモを書き足せます
            </p>
          </div>
        ) : null}

        {sections.map((section) => (
          <div key={section.key} className="mb-6 last:mb-0">
            <div className="mb-3 flex justify-center">
              <span className="rounded-full border border-border bg-card px-3 py-0.5 text-caption text-stone">
                {section.label}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {section.memos.map((memo) => (
                <MemoBubble key={memo.id} memo={memo} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <GroupMemoInput key={group.id} onSubmit={handleCreate} />

      <GroupNameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="グループの名前を変更"
        submitLabel="変更"
        initialName={group.name}
        onSubmit={handleRename}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleteMutation.isPending) setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>「{group.name}」を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            {memoCount > 0
              ? `メモ ${memoCount} 件も削除されます。元に戻せません。`
              : "このグループを削除します。元に戻せません。"}
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
              onClick={() => void handleDelete()}
            >
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
