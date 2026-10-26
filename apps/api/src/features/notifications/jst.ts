export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function jstParts(instant: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const jst = new Date(instant.getTime() + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
    weekday: jst.getUTCDay(),
    hour: jst.getUTCHours(),
    minute: jst.getUTCMinutes(),
  };
}

export function fromJst(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - JST_OFFSET_MS);
}

export function formatJstMd(instant: Date): string {
  const parts = jstParts(instant);
  return `${parts.month}/${parts.day}`;
}

export function formatJstMdHm(instant: Date): string {
  const parts = jstParts(instant);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  return `${parts.month}/${parts.day} ${hour}:${minute}`;
}

// instant の JST の日付（YYYY-MM-DD）。
export function jstDateString(instant: Date): string {
  return new Date(instant.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// YYYY-MM-DD の翌日。
export function nextDateString(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
  return next.toISOString().slice(0, 10);
}

// YYYY-MM-DD を「M/D」（0埋めなし）にする。
export function formatDateMd(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/${day}`;
}
