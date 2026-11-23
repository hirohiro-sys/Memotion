import { jstToday } from "../jst";

const INPUT_CLASS =
  "rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 focus:border-primary disabled:opacity-50 aria-invalid:border-destructive";

export type ScheduleDraft = { date: string; time: string };

// 予定の日付（必須）と時刻（任意）の欄。入力欄と日時ダイアログで共用する。
export function ScheduleFields({
  value,
  onChange,
  disabled,
  error,
}: {
  value: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const today = jstToday(new Date());

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-caption text-stone">
          日付
          <input
            type="date"
            required
            value={value.date}
            min={today}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            onChange={(event) =>
              onChange({ ...value, date: event.target.value })
            }
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-caption text-stone">
          時刻（任意）
          <input
            type="time"
            value={value.time}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...value, time: event.target.value })
            }
            className={INPUT_CLASS}
          />
        </label>
        {value.time !== "" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...value, time: "" })}
            className="pb-2 text-caption text-stone transition-colors duration-200 hover:text-foreground disabled:opacity-50"
          >
            時間未定にする
          </button>
        ) : null}
      </div>
      <p className="mt-2 min-h-4 text-caption">
        {error ? <span className="text-destructive">{error}</span> : null}
      </p>
    </div>
  );
}

// 過去の日付のエラー。日付が空、または今日以降なら null。
export function pastDateError(draft: ScheduleDraft, now: Date): string | null {
  return draft.date !== "" && draft.date < jstToday(now)
    ? "過去の日付は選べません"
    : null;
}
