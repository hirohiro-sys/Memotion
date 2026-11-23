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
  url: null,
  imageKey: null,
  mediaType: "text",
  source: "web",
  createdAt: "2026-11-23T00:00:00.000Z",
  groupId: null,
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
  it("returns the stored row", () => {
    expect(parseWebMemoRecord(record)).toEqual(record);
  });

  it("returns a schedule row with its date and time", () => {
    const schedule = {
      ...record,
      tag: "schedule",
      scheduledDate: "2026-11-24",
      scheduledTime: "09:30",
      groupId: "group_1",
    };
    expect(parseWebMemoRecord(schedule)).toEqual(schedule);
  });

  it("drops keys that are not part of the row", () => {
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

  it("treats a nullable field with a wrong type as no record", () => {
    expect(parseWebMemoRecord({ ...record, groupId: 1 })).toBeNull();
  });

  it("treats a missing nullable field as no record", () => {
    const { scheduledTime: _time, ...withoutTime } = record;
    expect(parseWebMemoRecord(withoutTime)).toBeNull();
  });
});
