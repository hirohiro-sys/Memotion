import { describe, expect, it } from "vitest";
import { isForeignKeyViolation } from "./constraint-error";

function drizzleQueryError(causeMessage: string) {
  return new Error("Failed query: insert into memos ...\nparams: ...", {
    cause: new Error(causeMessage),
  });
}

describe("isForeignKeyViolation", () => {
  it("detects a foreign key violation in the error cause", () => {
    expect(
      isForeignKeyViolation(
        drizzleQueryError(
          "FOREIGN KEY constraint failed: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_FOREIGNKEY)",
        ),
      ),
    ).toBe(true);
  });

  it("detects an unwrapped error", () => {
    expect(
      isForeignKeyViolation(
        new Error("D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT"),
      ),
    ).toBe(true);
  });

  it("ignores the phrase when it only appears in the drizzle message (memo content in params)", () => {
    expect(
      isForeignKeyViolation(
        new Error(
          "Failed query: insert into memos ...\nparams: FOREIGN KEY constraint failed",
          { cause: new Error("D1_ERROR: NOT NULL constraint failed") },
        ),
      ),
    ).toBe(false);
  });

  it("ignores a primary key conflict and a unique violation", () => {
    expect(
      isForeignKeyViolation(
        drizzleQueryError(
          "UNIQUE constraint failed: memos.id: SQLITE_CONSTRAINT",
        ),
      ),
    ).toBe(false);
    expect(
      isForeignKeyViolation(
        drizzleQueryError(
          "UNIQUE constraint failed: groups.user_id, groups.name: SQLITE_CONSTRAINT",
        ),
      ),
    ).toBe(false);
  });
});
