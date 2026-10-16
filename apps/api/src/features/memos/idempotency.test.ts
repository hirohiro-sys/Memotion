import { describe, expect, it } from "vitest";
import {
  decideCreateResult,
  type ExistingMemoRow,
  isPrimaryKeyConflict,
} from "./idempotency";

const existing: ExistingMemoRow = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  userId: "user_1",
  tag: "tweet",
  content: "眠い",
  url: null,
  imageKey: null,
  mediaType: "text",
  source: "web",
  createdAt: "2026-10-17T00:00:00.000Z",
};
const input = { tag: "tweet" as const, content: "眠い" };

describe("decideCreateResult for an existing row with the same id", () => {
  it("returns the existing memo when the same user resends the same content", () => {
    expect(
      decideCreateResult("primary_key_conflict", existing, input, "user_1"),
    ).toEqual({ kind: "existing", row: existing });
  });

  it("conflicts when only the content differs", () => {
    expect(
      decideCreateResult(
        "primary_key_conflict",
        existing,
        { ...input, content: "眠くない" },
        "user_1",
      ),
    ).toEqual({ kind: "conflict" });
  });

  it("conflicts when only the tag differs", () => {
    expect(
      decideCreateResult(
        "primary_key_conflict",
        existing,
        { ...input, tag: "tech" },
        "user_1",
      ),
    ).toEqual({ kind: "conflict" });
  });

  it("conflicts for another user's row even when the content is identical", () => {
    expect(
      decideCreateResult("primary_key_conflict", existing, input, "user_2"),
    ).toEqual({ kind: "conflict" });
  });

  it("does not include the existing memo in a conflict", () => {
    const decision = decideCreateResult(
      "primary_key_conflict",
      existing,
      input,
      "user_2",
    );
    expect(Object.keys(decision)).toEqual(["kind"]);
  });
});

describe("decideCreateResult from the save result", () => {
  it("creates when the insert succeeded", () => {
    expect(decideCreateResult("inserted", null, input, "user_1")).toEqual({
      kind: "created",
    });
  });

  it("returns existing, not created, for a resend of the same memo", () => {
    expect(
      decideCreateResult("primary_key_conflict", existing, input, "user_1")
        .kind,
    ).toBe("existing");
  });

  it("conflicts for a primary key conflict with another user's or different row", () => {
    expect(
      decideCreateResult("primary_key_conflict", existing, input, "user_2")
        .kind,
    ).toBe("conflict");
    expect(
      decideCreateResult(
        "primary_key_conflict",
        existing,
        { ...input, content: "別" },
        "user_1",
      ).kind,
    ).toBe("conflict");
  });

  it("fails to save when the conflicting row can no longer be read", () => {
    expect(
      decideCreateResult("primary_key_conflict", null, input, "user_1"),
    ).toEqual({ kind: "save_failed" });
  });

  it("fails to save for any other error instead of treating it as a conflict", () => {
    expect(decideCreateResult("failed", existing, input, "user_1")).toEqual({
      kind: "save_failed",
    });
  });
});

function drizzleQueryError(causeMessage: string) {
  return new Error("Failed query: insert into memos ...\nparams: ...", {
    cause: new Error(causeMessage),
  });
}

describe("isPrimaryKeyConflict", () => {
  it("detects a memos.id unique violation in the error cause", () => {
    expect(
      isPrimaryKeyConflict(
        drizzleQueryError(
          "D1_ERROR: UNIQUE constraint failed: memos.id: SQLITE_CONSTRAINT",
        ),
      ),
    ).toBe(true);
  });

  it("ignores a unique violation on another column", () => {
    expect(
      isPrimaryKeyConflict(
        drizzleQueryError(
          "D1_ERROR: UNIQUE constraint failed: memos.line_message_id: SQLITE_CONSTRAINT",
        ),
      ),
    ).toBe(false);
  });

  it("detects the message format observed from local D1 and an unwrapped error", () => {
    // wrangler d1 --local で実際に返った形（表名だけ memos に置き換え）。
    expect(
      isPrimaryKeyConflict(
        drizzleQueryError(
          "UNIQUE constraint failed: memos.id: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_PRIMARYKEY)",
        ),
      ),
    ).toBe(true);
    expect(
      isPrimaryKeyConflict(
        new Error("D1_ERROR: UNIQUE constraint failed: memos.id"),
      ),
    ).toBe(true);
  });

  it("does not match a column that only starts with id", () => {
    expect(
      isPrimaryKeyConflict(
        drizzleQueryError("UNIQUE constraint failed: memos.idx"),
      ),
    ).toBe(false);
  });

  it("ignores the phrase when it only appears in the drizzle message (memo content in params)", () => {
    expect(
      isPrimaryKeyConflict(
        new Error(
          "Failed query: insert into memos ...\nparams: UNIQUE constraint failed: memos.id",
          { cause: new Error("D1_ERROR: NOT NULL constraint failed") },
        ),
      ),
    ).toBe(false);
  });
});
