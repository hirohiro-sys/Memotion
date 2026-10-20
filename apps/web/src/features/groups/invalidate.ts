import type { QueryClient } from "@tanstack/react-query";

// グループへのメモの作成・「グループに追加」・グループの削除のあとに取り直す。
// ["groups"] は前方一致でグループの中身（["groups", id, "memos"]）も含む。
export async function invalidateAfterGroupWrite(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["memos"] }),
    queryClient.invalidateQueries({ queryKey: ["groups"] }),
    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  ]);
}
