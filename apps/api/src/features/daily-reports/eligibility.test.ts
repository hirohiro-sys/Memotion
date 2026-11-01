import { describe, expect, it } from "vitest";
import { decideMemoUse } from "./eligibility";

describe("decideMemoUse", () => {
  it("accepts owned memos that are not in a group", () => {
    expect(
      decideMemoUse(
        ["a", "b"],
        [
          { id: "a", groupId: null },
          { id: "b", groupId: null },
        ],
      ),
    ).toBe("ok");
  });

  it("reports a missing memo before a grouped one", () => {
    expect(
      decideMemoUse(["a", "missing"], [{ id: "a", groupId: "group_1" }]),
    ).toBe("not_found");
  });

  it("reports an extra row as not found before checking the group", () => {
    expect(
      decideMemoUse(
        ["a"],
        [
          { id: "a", groupId: "group_1" },
          { id: "b", groupId: null },
        ],
      ),
    ).toBe("not_found");
  });

  it("rejects a grouped memo once every requested id is present", () => {
    expect(
      decideMemoUse(
        ["a", "b"],
        [
          { id: "a", groupId: "group_1" },
          { id: "b", groupId: null },
        ],
      ),
    ).toBe("ineligible");
  });
});
