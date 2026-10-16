import { describe, expect, it } from "vitest";
import { resolveCreatedAt } from "./resolve-created-at";

const now = new Date("2026-10-17T12:00:00.000Z");

describe("resolveCreatedAt", () => {
  it("uses the current time when the client sends no time", () => {
    expect(resolveCreatedAt(undefined, now)).toBe("2026-10-17T12:00:00.000Z");
  });

  it("keeps a past time written on the device", () => {
    expect(resolveCreatedAt("2026-10-17T03:00:00.000Z", now)).toBe(
      "2026-10-17T03:00:00.000Z",
    );
  });

  it("normalizes an offset time to UTC toISOString form", () => {
    expect(resolveCreatedAt("2026-10-17T09:00:00+09:00", now)).toBe(
      "2026-10-17T00:00:00.000Z",
    );
  });

  it("keeps a time exactly 5 minutes ahead and replaces one beyond it", () => {
    expect(resolveCreatedAt("2026-10-17T12:05:00.000Z", now)).toBe(
      "2026-10-17T12:05:00.000Z",
    );
    expect(resolveCreatedAt("2026-10-17T12:05:00.001Z", now)).toBe(
      "2026-10-17T12:00:00.000Z",
    );
  });
});
