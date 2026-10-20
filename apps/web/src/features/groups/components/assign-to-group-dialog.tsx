import type { Group } from "@repo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/utils/format";
import { assignMemos } from "../api/assign-memos";
import { createGroup } from "../api/create-group";
import { DuplicateGroupNameError, GroupNotFoundError } from "../api/errors";
import { fetchGroups } from "../api/get-groups";
import { invalidateAfterGroupWrite } from "../invalidate";

const MAX_NAME_LENGTH = 50;

// メモタブで選んだメモを、既存のグループか、その場で作ったグループに入れる。
// 入れ先を選ぶ操作が確認を兼ねるので、選んだらすぐに入れる。
export function AssignToGroupDialog({
  open,
  onOpenChange,
  ids,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onAssigned: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
    enabled: open,
  });
  const groups = groupsQuery.data?.items;

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setName("");
    setDuplicate(false);
  }, [open]);

  // グループが0個のときは、作成の入力欄だけを出す。
  const showCreate = creating || groups?.length === 0;
  const trimmed = name.trim();
  const canCreate =
    trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH && !busy;

  function openGroup(groupId: string) {
    void navigate({ to: "/", search: { view: "groups", group: groupId } });
  }

  function notifyAssigned(
    group: Pick<Group, "id" | "name">,
    result: { added: number; skippedTodo: number },
  ) {
    const toastId = toast.add({
      title: `${result.added} 件を「${group.name}」に入れました`,
      description:
        result.skippedTodo > 0
          ? `やること ${result.skippedTodo} 件は入れませんでした`
          : undefined,
      type: "success",
      actionProps: {
        children: "開く",
        onClick: () => {
          toast.close(toastId);
          openGroup(group.id);
        },
      },
    });
  }

  async function assignTo(group: Pick<Group, "id" | "name">) {
    const result = await assignMemos(group.id, ids);
    onAssigned();
    onOpenChange(false);
    notifyAssigned(group, result);
  }

  async function handleSelect(group: Group) {
    if (busy) return;
    setBusy(true);
    try {
      await assignTo(group);
    } catch (error) {
      toast.add({
        title:
          error instanceof GroupNotFoundError
            ? "グループが見つかりません"
            : "グループに入れられませんでした。",
        type: "error",
      });
    } finally {
      setBusy(false);
      await invalidateAfterGroupWrite(queryClient);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    let created: Group;
    try {
      created = await createGroup(trimmed);
    } catch (error) {
      if (error instanceof DuplicateGroupNameError) {
        setDuplicate(true);
      } else {
        toast.add({ title: "作成できませんでした。", type: "error" });
        // 応答だけ切れてサーバーでは作れていることがあるので、一覧を取り直す。
        void queryClient.invalidateQueries({ queryKey: ["groups"] });
      }
      setBusy(false);
      return;
    }

    try {
      await assignTo(created);
    } catch {
      // 空のグループが残る。もう一度「グループに追加」で入れられる。
      onOpenChange(false);
      toast.add({
        title: "グループは作りましたが、メモを入れられませんでした",
        type: "error",
      });
    } finally {
      setBusy(false);
      await invalidateAfterGroupWrite(queryClient);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>{ids.length}件をグループに追加</AlertDialogTitle>
        <AlertDialogDescription className="mb-4">
          やることのメモは入れられません。
        </AlertDialogDescription>

        {groupsQuery.isPending ? (
          <div className="mb-6 space-y-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : groupsQuery.isError ? (
          <p className="mb-6 text-body-sm text-destructive">
            グループの取得に失敗しました
          </p>
        ) : (
          <div className="mb-6">
            {groups && groups.length > 0 ? (
              <ul className="mb-2 max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {groups.map((group) => (
                  <li key={group.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSelect(group)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-muted disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-medium text-foreground">
                          {group.name}
                        </span>
                        <span className="block text-caption text-stone">
                          {group.memoCount}件 · {formatDate(group.lastAddedAt)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-stone" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {showCreate ? (
              <form onSubmit={handleCreate}>
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setDuplicate(false);
                    }}
                    placeholder="新しいグループの名前"
                    aria-label="新しいグループの名前"
                    aria-invalid={duplicate}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 placeholder:text-stone focus:border-primary aria-invalid:border-destructive"
                  />
                  <Button type="submit" size="sm" disabled={!canCreate}>
                    作って入れる
                  </Button>
                </div>
                {duplicate ? (
                  <p className="mt-2 text-caption text-destructive">
                    同じ名前のグループがあります
                  </p>
                ) : trimmed.length > MAX_NAME_LENGTH ? (
                  <p className="mt-2 text-caption text-destructive">
                    {MAX_NAME_LENGTH}文字以内で入力してください
                  </p>
                ) : null}
              </form>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setCreating(true)}
                className="w-full justify-start text-stone"
              >
                <Plus />
                新しいグループを作る
              </Button>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button type="button" variant="ghost" size="sm" />}
            disabled={busy}
          >
            キャンセル
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
