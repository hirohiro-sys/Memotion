import { createFileRoute } from "@tanstack/react-router";
import { GroupsView } from "@/features/groups/components/groups-view";
import { MemoPageTabs } from "@/features/groups/components/memo-page-tabs";
import { MemoList } from "@/features/memos/components/memo-list";

type MemoPageSearch = { view?: "groups"; group?: string };

// 合わない組み合わせ（view が不正な値、view=memos に group が付いている等）はメモタブにする。
function validateMemoPageSearch(
  search: Record<string, unknown>,
): MemoPageSearch {
  if (search.view !== "groups") return {};
  const group = search.group;
  if (typeof group === "string" && group.length > 0 && group.length <= 64) {
    return { view: "groups", group };
  }
  return { view: "groups" };
}

export const Route = createFileRoute("/_app/")({
  validateSearch: validateMemoPageSearch,
  component: MemoListPage,
});

function MemoListPage() {
  const search = Route.useSearch();
  // 省いたキーも元の値のまま残ることがあるので、ここでも groups 以外をメモタブにする。
  const groups = search.view === "groups";
  return (
    <>
      <MemoPageTabs view={groups ? "groups" : "memos"} />
      {groups ? <GroupsView groupId={search.group} /> : <MemoList />}
    </>
  );
}
