import { describe, expect, it } from "vitest";
import {
  CRON_INTERVAL_MS,
  isSyncDue,
  MANUAL_INTERVAL_MS,
  syncNotAfter,
} from "./sync-timing";

const NOW = new Date("2026-10-28T12:00:00.000Z");

describe("isSyncDue", () => {
  it("is due when it has never been synced", () => {
    expect(isSyncDue(null, NOW, MANUAL_INTERVAL_MS)).toBe(true);
    expect(isSyncDue(null, NOW, CRON_INTERVAL_MS)).toBe(true);
  });

  it("manual: due at exactly 60 seconds, not at 59.999 seconds", () => {
    expect(isSyncDue("2026-10-28T11:59:00.000Z", NOW, MANUAL_INTERVAL_MS)).toBe(
      true,
    );
    expect(isSyncDue("2026-10-28T11:59:00.001Z", NOW, MANUAL_INTERVAL_MS)).toBe(
      false,
    );
  });

  it("cron: due at exactly 1 hour, not one millisecond before", () => {
    expect(isSyncDue("2026-10-28T11:00:00.000Z", NOW, CRON_INTERVAL_MS)).toBe(
      true,
    );
    expect(isSyncDue("2026-10-28T11:00:00.001Z", NOW, CRON_INTERVAL_MS)).toBe(
      false,
    );
  });

  it("is not due when it just synced", () => {
    expect(isSyncDue(NOW.toISOString(), NOW, MANUAL_INTERVAL_MS)).toBe(false);
  });
});

describe("syncNotAfter", () => {
  it("is the instant one interval before now, in the stored format", () => {
    expect(syncNotAfter(NOW, MANUAL_INTERVAL_MS)).toBe(
      "2026-10-28T11:59:00.000Z",
    );
    expect(syncNotAfter(NOW, CRON_INTERVAL_MS)).toBe(
      "2026-10-28T11:00:00.000Z",
    );
  });
});
