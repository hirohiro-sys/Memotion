export type IndependentTask = {
  name: string;
  run: () => Promise<void>;
};

// 通知を1つずつ実行する。1つが例外を投げても残りを実行し、失敗した名前を返す。
export async function runIndependently(
  tasks: IndependentTask[],
): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  for (const task of tasks) {
    try {
      await task.run();
    } catch {
      failed.push(task.name);
    }
  }
  return { failed };
}
