import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "@/components/ui/toast";

// 一覧へ戻した（または自分で削除した）グループ。一覧と中身の両方から呼ばれても、知らせるのは1回だけにする。
const handledGroupIds = new Set<string>();

// 自分で削除したグループは、このあと見つからなくてもエラーとして知らせない。
export function markGroupHandled(groupId: string) {
  handledGroupIds.add(groupId);
}

// 開いているグループが無くなっていた（削除済み、別の端末で削除された等）ときに、一覧へ戻す。
export function useLeaveMissingGroup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(
    (groupId: string) => {
      if (handledGroupIds.has(groupId)) return;
      handledGroupIds.add(groupId);
      toast.add({ title: "グループが見つかりません", type: "error" });
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      void navigate({ to: "/", search: { view: "groups" }, replace: true });
    },
    [navigate, queryClient],
  );
}
