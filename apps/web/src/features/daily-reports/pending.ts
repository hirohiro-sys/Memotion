declare module "@tanstack/react-router" {
  interface HistoryState {
    pendingMemoIds?: string[];
    pendingStamp?: number;
  }
}

let liveStamp = 0;

export function nextPendingStamp(): number {
  liveStamp += 1;
  return liveStamp;
}

// 再読み込みでモジュールの値が戻るので、履歴に残った ID は出さない。
export function isPendingStampLive(stamp: number | undefined): boolean {
  return stamp !== undefined && stamp === liveStamp;
}
