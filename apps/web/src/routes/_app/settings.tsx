import type { MemoTag } from "@repo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { logout } from "@/features/auth/api/logout";
import { fetchMemos } from "@/features/memos/api/get-memos";
import { SettingsView } from "@/features/notifications/components/settings-view";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const memosQuery = useQuery({ queryKey: ["memos"], queryFn: fetchMemos });
  const memos = memosQuery.data?.items ?? [];

  const tagCounts: Record<MemoTag, number> = {
    tweet: 0,
    tech: 0,
    other: 0,
    todo: 0,
  };
  for (const memo of memos) tagCounts[memo.tag] += 1;

  async function handleLogout() {
    await logout();
    await queryClient.clear();
    await navigate({ to: "/login" });
  }

  return (
    <SettingsView
      memoCount={memos.length}
      memosPending={memosQuery.isPending}
      tagCounts={tagCounts}
      onLogout={handleLogout}
    />
  );
}
