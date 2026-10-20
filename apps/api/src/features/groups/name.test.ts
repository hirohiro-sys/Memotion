import { describe, expect, it } from "vitest";
import { isDuplicateGroupName } from "./name";

function drizzleQueryError(causeMessage: string) {
  return new Error("Failed query: insert into groups ...\nparams: ...", {
    cause: new Error(causeMessage),
  });
}

describe("isDuplicateGroupName", () => {
  it("detects a (user_id, name) unique violation in the error cause", () => {
    expect(
      isDuplicateGroupName(
        drizzleQueryError(
          "UNIQUE constraint failed: groups.user_id, groups.name: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)",
        ),
      ),
    ).toBe(true);
  });

  it("ignores the phrase when it only appears in the drizzle message (group name in params)", () => {
    expect(
      isDuplicateGroupName(
        new Error(
          "Failed query: insert into groups ...\nparams: UNIQUE constraint failed: groups.user_id, groups.name",
          { cause: new Error("D1_ERROR: NOT NULL constraint failed") },
        ),
      ),
    ).toBe(false);
  });

  it("ignores a memos.id primary key conflict and other constraint violations", () => {
    expect(
      isDuplicateGroupName(
        drizzleQueryError(
          "UNIQUE constraint failed: memos.id: SQLITE_CONSTRAINT",
        ),
      ),
    ).toBe(false);
    expect(
      isDuplicateGroupName(
        drizzleQueryError(
          "UNIQUE constraint failed: groups.id: SQLITE_CONSTRAINT",
        ),
      ),
    ).toBe(false);
    expect(
      isDuplicateGroupName(
        drizzleQueryError("FOREIGN KEY constraint failed: SQLITE_CONSTRAINT"),
      ),
    ).toBe(false);
  });
});
