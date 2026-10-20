import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CloudOff, FolderOpen, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useOnlineStatus } from "@/features/memos/offline/use-online-status";
import { cn } from "@/utils/cn";
import { createGroup } from "../api/create-group";
import { DuplicateGroupNameError } from "../api/errors";
import { fetchGroups } from "../api/get-groups";
import { useIsDesktop } from "../use-is-desktop";
import { useLeaveMissingGroup } from "../use-leave-missing-group";
import { GroupDetail } from "./group-detail";
import { GroupList } from "./group-list";
import { GroupNameDialog } from "./group-name-dialog";

export function GroupsView({ groupId }: { groupId?: string }) {
  const online = useOnlineStatus();

  if (!online) {
    return (
      <div className="mx-auto max-w-[1440px] p-4 md:p-8">
        <p className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-body-sm text-stone">
          <CloudOff className="size-4 shrink-0" />
          オフラインのためグループは使えません
        </p>
      </div>
    );
  }
  return <OnlineGroupsView groupId={groupId} />;
}

function OnlineGroupsView({ groupId }: { groupId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const leaveMissingGroup = useLeaveMissingGroup();
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const groups = groupsQuery.data?.items;
  const selected = groups?.find((group) => group.id === groupId);
  const [createOpen, setCreateOpen] = useState(false);

  // PC で group が無いときは、先頭のグループを開く（履歴は増やさない）。
  const firstGroupId = groups?.[0]?.id;
  useEffect(() => {
    if (!isDesktop || groupId || !firstGroupId) return;
    void navigate({
      to: "/",
      search: { view: "groups", group: firstGroupId },
      replace: true,
    });
  }, [isDesktop, groupId, firstGroupId, navigate]);

  // URL の group が一覧に無い（削除済み、別の端末で削除された等）なら一覧へ戻す。
  const missing =
    groupId !== undefined &&
    groupsQuery.isSuccess &&
    !groupsQuery.isFetching &&
    !selected;
  useEffect(() => {
    if (missing && groupId) leaveMissingGroup(groupId);
  }, [missing, groupId, leaveMissingGroup]);

  async function handleCreate(name: string) {
    let created: Awaited<ReturnType<typeof createGroup>>;
    try {
      created = await createGroup(name);
    } catch (error) {
      if (!(error instanceof DuplicateGroupNameError)) {
        toast.add({ title: "作成できませんでした。", type: "error" });
      }
      throw error;
    }
    await queryClient.invalidateQueries({ queryKey: ["groups"] });
    setCreateOpen(false);
    await navigate({
      to: "/",
      search: { view: "groups", group: created.id },
    });
  }

  const createDialog = (
    <GroupNameDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      title="新しいグループを作る"
      submitLabel="作成"
      onSubmit={handleCreate}
    />
  );

  // 作成のダイアログは、空の表示から一覧に切り替わっても作り直さないよう、常に同じ位置に置く。
  return (
    <>
      {renderContent()}
      {createDialog}
    </>
  );

  function renderContent() {
    if (groupsQuery.isPending) {
      return (
        <div className="mx-auto max-w-[1440px] p-4 md:p-8">
          <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="hidden h-48 rounded-xl md:block" />
          </div>
        </div>
      );
    }

    // 取得済みの一覧があれば、裏の取り直しの失敗では画面を差し替えない。
    if (groupsQuery.isError && groupsQuery.data === undefined) {
      return (
        <p className="py-20 text-center text-body-sm text-destructive">
          グループの取得に失敗しました
        </p>
      );
    }

    if (groupsQuery.data === undefined) return null;

    if (groupsQuery.data.items.length === 0) {
      return (
        <div className="mx-auto max-w-[1440px] p-4 md:p-8">
          <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
            <FolderOpen className="mx-auto mb-3 size-5 text-stone" />
            <p className="mb-4 text-body-sm text-stone">
              まだグループがありません
            </p>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus />
              新しいグループを作る
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-[1440px] p-4 md:p-8">
        <div className="grid items-start gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className={cn(groupId ? "hidden md:block" : "block")}>
            <GroupList
              groups={groupsQuery.data.items}
              selectedId={groupId}
              onCreate={() => setCreateOpen(true)}
            />
          </div>
          <div className={cn(groupId ? "block" : "hidden md:block")}>
            {selected ? <GroupDetail group={selected} /> : null}
          </div>
        </div>
      </div>
    );
  }
}
