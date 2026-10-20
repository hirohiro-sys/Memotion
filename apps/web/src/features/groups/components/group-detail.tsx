import type {
  CreateMemoRequest,
  Group,
  GroupListResponse,
  MemoTag,
} from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { TAG_ORDER } from "@/config/tag-meta";
import { MemoCard } from "@/features/memos/components/memo-card";
import { MemoListSkeleton } from "@/features/memos/components/memo-card-skeleton";
import { MemoComposer } from "@/features/memos/components/memo-composer";
import { createGroupMemo } from "../api/create-group-memo";
import { deleteGroup } from "../api/delete-group";
import {
  DuplicateGroupNameError,
  GroupNotFoundError,
  UnauthorizedError,
} from "../api/errors";
import { fetchGroupMemos } from "../api/get-group-memos";
import { renameGroup } from "../api/rename-group";
import { invalidateAfterGroupWrite } from "../invalidate";
import { useIsDesktop } from "../use-is-desktop";
import {
  markGroupHandled,
  useLeaveMissingGroup,
} from "../use-leave-missing-group";
import { GroupNameDialog } from "./group-name-dialog";

// todo はグループに入れられない。
const GROUP_TAGS: MemoTag[] = TAG_ORDER.filter((tag) => tag !== "todo");

export function GroupDetail({ group }: { group: Group }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const leaveMissingGroup = useLeaveMissingGroup();
  const isDesktop = useIsDesktop();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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

  useEffect(() => {
    if (memosQuery.error instanceof GroupNotFoundError) {
      leaveMissingGroup(group.id);
    }
  }, [memosQuery.error, group.id, leaveMissingGroup]);

  const createMutation = useMutation({
    mutationFn: (input: CreateMemoRequest) => {
      if (input.tag === "todo") throw new Error("todo is not allowed");
      const pending = pendingRef.current;
      const id =
        pending?.tag === input.tag && pending.content === input.content
          ? pending.id
          : crypto.randomUUID();
      pendingRef.current = { tag: input.tag, content: input.content, id };
      return createGroupMemo(group.id, {
        ...input,
        tag: input.tag,
        id,
        createdAt: new Date().toISOString(),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(group.id),
  });

  // 失敗したら reject して、入力欄に本文を残す。
  async function handleCreate(input: CreateMemoRequest) {
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
    <section aria-label={group.name}>
      <Link
        to="/"
        search={{ view: "groups" }}
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm text-stone transition-colors duration-200 hover:text-foreground md:hidden"
      >
        <ArrowLeft className="size-4" />
        グループ一覧
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-heading-sm font-semibold text-foreground">
            {group.name}
          </h2>
          <p className="mt-1 text-caption tabular-nums text-stone">
            メモ {memoCount}件
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setRenameOpen(true)}
          >
            名前を変更
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={() => setDeleteOpen(true)}
          >
            グループを削除
          </Button>
        </div>
      </div>

      <MemoComposer
        key={group.id}
        busy={createMutation.isPending}
        onSubmit={handleCreate}
        tags={GROUP_TAGS}
        clearOnSubmit
      />

      {memosQuery.isPending && <MemoListSkeleton />}

      {memosQuery.isError &&
        !(memosQuery.error instanceof GroupNotFoundError) && (
          <p className="py-20 text-center text-body-sm text-destructive">
            メモの取得に失敗しました
          </p>
        )}

      {memos && memos.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Inbox className="mx-auto mb-3 size-5 text-stone" />
          <p className="text-body-sm text-stone">まだメモがありません</p>
        </div>
      )}

      {memos && memos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {memos.map((memo) => (
            <MemoCard key={memo.id} memo={memo} busy={false} selected={false} />
          ))}
        </div>
      )}

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
