import { describe, expect, it } from "vitest";
import { hasConstraintCause } from "./constraint-error";

const PATTERN = /UNIQUE constraint failed: memos\.id(?!\w)/;

describe("hasConstraintCause", () => {
  it("finds the violation in the cause of a drizzle error", () => {
    const error = new Error(
      "Failed query: insert into memos ...\nparams: ...",
      {
        cause: new Error("D1_ERROR: UNIQUE constraint failed: memos.id"),
      },
    );
    expect(hasConstraintCause(error, PATTERN)).toBe(true);
  });

  it("finds the violation in an unwrapped error", () => {
    expect(
      hasConstraintCause(
        new Error("D1_ERROR: UNIQUE constraint failed: memos.id"),
        PATTERN,
      ),
    ).toBe(true);
  });

  it("finds the violation in a nested cause", () => {
    const error = new Error("Failed query: ...", {
      cause: new Error("D1_ERROR: wrapper", {
        cause: new Error("UNIQUE constraint failed: memos.id"),
      }),
    });
    expect(hasConstraintCause(error, PATTERN)).toBe(true);
  });

  it("ignores the phrase when it only appears in the drizzle message (params)", () => {
    const error = new Error(
      "Failed query: insert into memos ...\nparams: UNIQUE constraint failed: memos.id",
      { cause: new Error("D1_ERROR: NOT NULL constraint failed") },
    );
    expect(hasConstraintCause(error, PATTERN)).toBe(false);
  });

  it("stops after five levels of cause", () => {
    let error: Error = new Error("UNIQUE constraint failed: memos.id");
    for (let i = 0; i < 5; i += 1) {
      error = new Error(`wrapper ${i}`, { cause: error });
    }
    expect(hasConstraintCause(error, PATTERN)).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(hasConstraintCause(undefined, PATTERN)).toBe(false);
    expect(
      hasConstraintCause("UNIQUE constraint failed: memos.id", PATTERN),
    ).toBe(false);
  });
});
