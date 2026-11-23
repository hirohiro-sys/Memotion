import { describe, expect, it } from "vitest";
import type { WebMemoRecord } from "./dedup-record";
import { decideResend } from "./idempotency";

const record: WebMemoRecord = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  userId: "user_1",
  tag: "tweet",
  content: "眠い",
  mediaType: "text",
  source: "web",
  createdAt: "2026-10-17T00:00:00.000Z",
  scheduledDate: null,
  scheduledTime: null,
};
const input = { tag: "tweet" as const, content: "眠い" };

describe("decideResend", () => {
  it("returns the recorded memo when the same user resends the same content", () => {
    expect(decideResend(record, input, "user_1")).toEqual({
      kind: "existing",
      record,
    });
  });

  it("conflicts when only the content differs", () => {
    expect(
      decideResend(record, { ...input, content: "眠くない" }, "user_1"),
    ).toEqual({ kind: "conflict" });
  });

  it("conflicts when only the tag differs", () => {
    expect(decideResend(record, { ...input, tag: "tech" }, "user_1")).toEqual({
      kind: "conflict",
    });
  });

  it("conflicts for another user's record even when the content is identical", () => {
    expect(decideResend(record, input, "user_2")).toEqual({
      kind: "conflict",
    });
  });

  it("does not include the recorded memo in a conflict", () => {
    expect(Object.keys(decideResend(record, input, "user_2"))).toEqual([
      "kind",
    ]);
  });
});

describe("decideResend for a schedule", () => {
  const schedule: WebMemoRecord = {
    ...record,
    tag: "schedule",
    content: "歯医者",
    scheduledDate: "2026-11-24",
    scheduledTime: "09:30",
  };
  const scheduleInput = {
    tag: "schedule" as const,
    content: "歯医者",
    scheduledDate: "2026-11-24",
    scheduledTime: "09:30",
  };

  it("returns the recorded memo when the date and time match", () => {
    expect(decideResend(schedule, scheduleInput, "user_1").kind).toBe(
      "existing",
    );
  });

  it("conflicts when the date or the time differs", () => {
    expect(
      decideResend(
        schedule,
        { ...scheduleInput, scheduledDate: "2026-11-25" },
        "user_1",
      ).kind,
    ).toBe("conflict");
    expect(
      decideResend(
        schedule,
        { ...scheduleInput, scheduledTime: "10:00" },
        "user_1",
      ).kind,
    ).toBe("conflict");
  });

  it("treats an omitted time as the same as a recorded null time", () => {
    const untimed = { ...schedule, scheduledTime: null };
    const { scheduledTime: _time, ...withoutTime } = scheduleInput;
    expect(decideResend(untimed, withoutTime, "user_1").kind).toBe("existing");
    expect(
      decideResend(untimed, { ...scheduleInput, scheduledTime: null }, "user_1")
        .kind,
    ).toBe("existing");
  });

  it("conflicts when the record is a tweet with the same content", () => {
    expect(
      decideResend({ ...record, content: "歯医者" }, scheduleInput, "user_1")
        .kind,
    ).toBe("conflict");
  });

  it("does not compare dates for an input that is not a schedule", () => {
    expect(
      decideResend({ ...record, scheduledDate: "2026-11-24" }, input, "user_1")
        .kind,
    ).toBe("existing");
  });
});
