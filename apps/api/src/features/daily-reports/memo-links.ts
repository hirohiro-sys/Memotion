// 1行が id、report_id、memo_id の3つ。D1 のバインド変数は100まで。
export const MEMO_LINK_CHUNK = 33;

export function chunkMemoLinks<T>(rows: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += MEMO_LINK_CHUNK) {
    chunks.push(rows.slice(index, index + MEMO_LINK_CHUNK));
  }
  return chunks;
}
