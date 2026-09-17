import { fromJst, jstParts, WEEK_MS } from "./jst";

export type WeeklySlot = {
  weekday: number;
  time: string;
};

export type DigestWindow = {
  start: Date;
  end: Date;
};

function parseHm(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

function sentAtMs(lastSentAt: string | null): number | null {
  if (lastSentAt == null) return null;
  const ms = Date.parse(lastSentAt);
  return Number.isNaN(ms) ? null : ms;
}

export function latestDueAt(now: Date, slot: WeeklySlot): Date {
  const { hour, minute } = parseHm(slot.time);
  const parts = jstParts(now);
  const daysBack = (parts.weekday - slot.weekday + 7) % 7;
  const sameDay = fromJst(parts.year, parts.month, parts.day, hour, minute);
  const candidate = new Date(
    sameDay.getTime() - daysBack * 24 * 60 * 60 * 1000,
  );
  if (candidate.getTime() > now.getTime()) {
    return new Date(candidate.getTime() - WEEK_MS);
  }
  return candidate;
}

export function windowEndingAt(due: Date): DigestWindow {
  return {
    start: new Date(due.getTime() - WEEK_MS),
    end: due,
  };
}

export function isDueToSend(
  now: Date,
  slot: WeeklySlot,
  lastSentAt: string | null,
): boolean {
  const due = latestDueAt(now, slot).getTime();
  const sent = sentAtMs(lastSentAt);
  return sent == null || sent < due;
}

export function nextDigestWindow(
  now: Date,
  slot: WeeklySlot,
  lastSentAt: string | null,
): DigestWindow {
  const due = latestDueAt(now, slot);
  if (isDueToSend(now, slot, lastSentAt)) {
    return windowEndingAt(due);
  }
  return {
    start: due,
    end: new Date(due.getTime() + WEEK_MS),
  };
}

export function isInstantInWindow(
  createdAt: string,
  window: DigestWindow,
): boolean {
  const ms = Date.parse(createdAt);
  if (Number.isNaN(ms)) return false;
  return ms >= window.start.getTime() && ms < window.end.getTime();
}
