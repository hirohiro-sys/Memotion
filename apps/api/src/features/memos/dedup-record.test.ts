import { describe, expect, it } from "vitest";
import {
  LINE_MESSAGE_TTL_SECONDS,
  lineMessageKey,
  parseWebMemoRecord,
  WEB_MEMO_TTL_SECONDS,
  webMemoKey,
} from "./dedup-record";

const record = {
  id: "8f2c1d4e-0b6a-4c3e-9d1f-2a7b5c8e9f01",
  userId: "user_1",
  tag: "tweet",
  content: "眠い",
  mediaType: "text",
  source: "web",
  createdAt: "2026-11-23T00:00:00.000Z",
  scheduledDate: null,
  scheduledTime: null,
};

describe("dedup keys", () => {
  it("separates LINE messages and Web memos by prefix", () => {
    expect(lineMessageKey("5000")).toBe("line-message:5000");
    expect(webMemoKey("5000")).toBe("web-memo:5000");
  });

  it("keeps LINE records for 7 days and Web records for 30 days", () => {
    expect(LINE_MESSAGE_TTL_SECONDS).toBe(604_800);
    expect(WEB_MEMO_TTL_SECONDS).toBe(2_592_000);
  });
});

describe("parseWebMemoRecord", () => {
  it("returns the stored record", () => {
    expect(parseWebMemoRecord(record)).toEqual(record);
  });

  it("returns a schedule record with its date and time", () => {
    const schedule = {
      ...record,
      tag: "schedule",
      scheduledDate: "2026-11-24",
      scheduledTime: "09:30",
    };
    expect(parseWebMemoRecord(schedule)).toEqual(schedule);
  });

  it("reads a record written while D1 was the store and drops its D1-only keys", () => {
    expect(
      parseWebMemoRecord({
        ...record,
        url: null,
        imageKey: null,
        groupId: "group_1",
      }),
    ).toEqual(record);
  });

  it("drops keys that are not part of the record", () => {
    expect(parseWebMemoRecord({ ...record, extra: "x" })).toEqual(record);
  });

  it("treats a missing record as no record", () => {
    expect(parseWebMemoRecord(null)).toBeNull();
  });

  it("treats a non-object value as no record", () => {
    expect(parseWebMemoRecord("web-memo")).toBeNull();
  });

  it("treats a record without the owner as no record", () => {
    const { userId: _userId, ...withoutOwner } = record;
    expect(parseWebMemoRecord(withoutOwner)).toBeNull();
  });

  it("treats an unknown tag, media type or source as no record", () => {
    expect(parseWebMemoRecord({ ...record, tag: "memo" })).toBeNull();
    expect(parseWebMemoRecord({ ...record, mediaType: "image" })).toBeNull();
    expect(parseWebMemoRecord({ ...record, source: "api" })).toBeNull();
  });

  it("treats a nullable field with a wrong type as no record", () => {
    expect(parseWebMemoRecord({ ...record, scheduledDate: 1 })).toBeNull();
  });

  it("treats a missing nullable field as no record", () => {
    const { scheduledTime: _time, ...withoutTime } = record;
    expect(parseWebMemoRecord(withoutTime)).toBeNull();
  });
});
