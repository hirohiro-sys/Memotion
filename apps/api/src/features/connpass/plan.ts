export type ConnpassOpenStatus = "preopen" | "open" | "close" | "cancelled";

export type ConnpassEvent = {
  id: number;
  title: string;
  // 開催日時（ISO-8601）。告知のみのイベントなどでは null。
  startedAt: string | null;
  openStatus: ConnpassOpenStatus;
};

// 対応表（connpass_imports）の1行。memoId が null なら、ユーザーが予定を消した。
export type ImportRow = {
  eventId: number;
  memoId: string | null;
  importedTitle: string;
  importedDate: string;
  importedTime: string | null;
};

export type ScheduleValues = {
  title: string;
  date: string;
  time: string;
};

export type SyncAction =
  | { type: "create"; eventId: number; values: ScheduleValues }
  | {
      type: "update";
      eventId: number;
      memoId: string;
      values: ScheduleValues;
    }
  | { type: "delete"; eventId: number; memoId: string };

const MAX_TITLE_LENGTH = 200;

// 前後の空白を除き、200 文字で切る。絵文字や国旗などを途中で割らないよう、見た目の1文字（書記素）で数える。
export function normalizeTitle(title: string): string {
  const segmenter = new Intl.Segmenter();
  return Array.from(segmenter.segment(title.trim()), (part) => part.segment)
    .slice(0, MAX_TITLE_LENGTH)
    .join("");
}

// 取得した予定と対応表を突き合わせ、作成・更新・削除を決める。純粋関数。
// toSchedule は開催日時を JST の日付と時刻にする（読めなければ null）。
export function planConnpassSync(input: {
  events: ConnpassEvent[];
  // 全ページを最後まで取れたか。取れていないときは削除しない。
  complete: boolean;
  imports: ImportRow[];
  today: string;
  rangeEnd: string;
  toSchedule: (startedAt: string) => { date: string; time: string } | null;
}): SyncAction[] {
  const importsByEvent = new Map(
    input.imports.map((row) => [row.eventId, row]),
  );
  const actions: SyncAction[] = [];
  // 今日以降に開催されるイベントの ID（中止も含む）。
  const upcomingIds = new Set<number>();
  // 開催日時が無い・読めないイベント。日付が分からないので、予定を消す対象にもしない。
  const undatedIds = new Set<number>();
  const seen = new Set<number>();

  for (const event of input.events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const when =
      event.startedAt === null ? null : input.toSchedule(event.startedAt);
    if (when === null) {
      undatedIds.add(event.id);
      continue;
    }
    if (when.date < input.today) continue;
    upcomingIds.add(event.id);

    const row = importsByEvent.get(event.id);
    if (event.openStatus === "cancelled") {
      if (row?.memoId) {
        actions.push({ type: "delete", eventId: event.id, memoId: row.memoId });
      }
      continue;
    }

    const title = normalizeTitle(event.title);
    if (!row) {
      if (title !== "") {
        actions.push({
          type: "create",
          eventId: event.id,
          values: { title, date: when.date, time: when.time },
        });
      }
      continue;
    }
    if (row.memoId === null) continue;
    // 名前が空になったときは、前回の名前のまま、日付と時刻だけを合わせる。
    const values: ScheduleValues = {
      title: title === "" ? row.importedTitle : title,
      date: when.date,
      time: when.time,
    };
    if (
      row.importedTitle !== values.title ||
      row.importedDate !== when.date ||
      row.importedTime !== when.time
    ) {
      actions.push({
        type: "update",
        eventId: event.id,
        memoId: row.memoId,
        values,
      });
    }
  }

  // 取得結果から消えた（参加を取り消した）予定は、最後まで取れたときだけ消す。
  // 開催済みの予定と、取得した範囲より先の予定は残す。
  if (input.complete) {
    for (const row of input.imports) {
      if (row.memoId === null) continue;
      if (upcomingIds.has(row.eventId) || undatedIds.has(row.eventId)) continue;
      if (row.importedDate < input.today || row.importedDate > input.rangeEnd) {
        continue;
      }
      actions.push({
        type: "delete",
        eventId: row.eventId,
        memoId: row.memoId,
      });
    }
  }
  return actions;
}
