import type { CreateMemoRequest, MemoTag } from "@repo/shared";
import { SendHorizontal } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { PILL_BASE, PILL_IDLE, TAG_META, TAG_ORDER } from "@/config/tag-meta";
import {
  pastDateError,
  type ScheduleDraft,
  ScheduleFields,
} from "@/features/schedule/components/schedule-fields";
import { jstToday } from "@/features/schedule/jst";
import { cn } from "@/utils/cn";
import { useOnlineStatus } from "../offline/use-online-status";

export function MemoComposer({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (input: CreateMemoRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const online = useOnlineStatus();
  const [tag, setTag] = useState<MemoTag>("tweet");
  const [content, setContent] = useState("");
  const [schedule, setSchedule] = useState<ScheduleDraft>(() => ({
    date: jstToday(new Date()),
    time: "",
  }));
  const [offlineError, setOfflineError] = useState(false);
  // 予定は未送信リストを通らないので、送り直しの冪等キーをここで持つ。
  // 同じ内容のあいだは同じ id を使い、内容を変えたら新しい id にする（変えた内容が 409 にならないように）。
  const scheduleIdRef = useRef<{ key: string; id: string } | null>(null);
  const isSchedule = tag === "schedule";
  const pastError = isSchedule ? pastDateError(schedule, new Date()) : null;
  // 予定がオフラインで外れた直後は送らせない（日付を捨てたつぶやきとして積まないため）。
  const canSubmit =
    content.trim().length > 0 &&
    !busy &&
    !offlineError &&
    (!isSchedule || (schedule.date !== "" && pastError === null));

  // 入力欄の表示中にオフラインになったら、予定の選択を外す（日付の欄は閉じる）。
  // 黙ってつぶやきに戻さないよう、外したことを知らせる。
  useEffect(() => {
    if (online) {
      setOfflineError(false);
      return;
    }
    if (tag === "schedule") {
      setTag("tweet");
      setOfflineError(true);
    }
  }, [online, tag]);

  function submit() {
    if (!canSubmit) return;
    if (isSchedule) {
      // 入力欄を開いたまま日付が変わると、選んだ「今日」が過去になる。送る直前に確かめる。
      if (pastDateError(schedule, new Date()) !== null) return;
      // 予定は未送信リストに積めない。日時を捨てたつぶやきにせず、入力を残して知らせる。
      if (!online || !navigator.onLine) {
        setOfflineError(true);
        return;
      }
      const scheduledTime = schedule.time === "" ? null : schedule.time;
      const key = JSON.stringify([content, schedule.date, scheduledTime]);
      if (scheduleIdRef.current?.key !== key) {
        scheduleIdRef.current = { key, id: crypto.randomUUID() };
      }
      return onSubmit({
        id: scheduleIdRef.current.id,
        tag,
        content,
        scheduledDate: schedule.date,
        scheduledTime,
      });
    }
    // オフラインでは分類を選ばせず、すべて「つぶやき」で積む。
    return onSubmit({ tag: online ? tag : "tweet", content });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  // Enter は改行。⌘ / Ctrl + Enter は「送信」と同じ（変換中は送らない）。
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-border bg-card p-6"
    >
      {online ? null : (
        <p className="mb-4 text-caption text-stone">
          オフラインです。メモは「つぶやき」として保存し、オンラインに戻ると自動で送信します。
        </p>
      )}
      <div
        className={cn(
          "mb-4 flex flex-wrap items-center gap-2",
          !online && "hidden",
        )}
      >
        {TAG_ORDER.map((option) => {
          const meta = TAG_META[option];
          const active = tag === option;
          return (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => {
                setTag(option);
                setOfflineError(false);
              }}
              className={cn(PILL_BASE, active ? meta.className : PILL_IDLE)}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {offlineError ? (
        <p className="mb-4 text-caption text-destructive">
          オフラインのため予定は登録できません
        </p>
      ) : null}
      {isSchedule ? (
        <div className="mb-2">
          <ScheduleFields
            value={schedule}
            onChange={setSchedule}
            disabled={busy || !online}
            error={pastError}
          />
        </div>
      ) : null}

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="メモを入力..."
        rows={3}
        onKeyDown={handleKeyDown}
        className="mb-4 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none transition-colors duration-200 placeholder:text-stone focus:border-primary"
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          キャンセル
        </Button>
        <Button
          type="submit"
          variant="outline"
          size="icon"
          disabled={!canSubmit}
          aria-label="送信"
          className="border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </form>
  );
}
