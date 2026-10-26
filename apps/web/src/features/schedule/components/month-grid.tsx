import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAYS } from "@/config/tag-meta";
import { cn } from "@/utils/cn";
import { buildMonthGrid } from "../month-grid";

const navButtonClass =
  "rounded-lg p-1.5 text-stone transition-colors duration-200 hover:bg-muted hover:text-foreground";

// 月のカレンダー。予定がある日に点を1つ付ける（件数によらない）。
export function MonthGrid({
  year,
  month,
  today,
  selected,
  scheduledDates,
  onSelect,
  onShiftMonth,
  onToday,
}: {
  year: number;
  month: number;
  today: string;
  selected: string;
  scheduledDates: Set<string>;
  onSelect: (date: string) => void;
  onShiftMonth: (delta: number) => void;
  onToday: () => void;
}) {
  const weeks = buildMonthGrid(year, month);

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <div className="mb-4 flex items-center gap-1">
        <h2 className="flex-1 text-body font-medium text-foreground tabular-nums">
          {year}年{month}月
        </h2>
        <button
          type="button"
          onClick={onToday}
          className="rounded-lg px-2.5 py-1 text-caption text-stone transition-colors duration-200 hover:bg-muted hover:text-foreground"
        >
          今日
        </button>
        <button
          type="button"
          onClick={() => onShiftMonth(-1)}
          aria-label="前の月"
          className={navButtonClass}
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onShiftMonth(1)}
          aria-label="次の月"
          className={navButtonClass}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="pb-2 text-caption text-stone">
            {weekday}
          </div>
        ))}
        {weeks.flat().map((cell) => {
          const isToday = cell.date === today;
          const isSelected = cell.date === selected;
          const hasSchedule = scheduledDates.has(cell.date);
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onSelect(cell.date)}
              aria-pressed={isSelected}
              aria-label={`${cell.date}${hasSchedule ? "、予定あり" : ""}`}
              className={cn(
                "flex h-12 flex-col items-center justify-center gap-1 rounded-lg transition-colors duration-200 md:h-14",
                isSelected ? "bg-muted" : "hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-body-sm tabular-nums",
                  isToday
                    ? "bg-primary font-medium text-primary-foreground"
                    : cell.inMonth
                      ? "text-foreground"
                      : "text-stone/60",
                  isSelected && !isToday && "font-medium",
                )}
              >
                {cell.day}
              </span>
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  hasSchedule ? "bg-primary" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
