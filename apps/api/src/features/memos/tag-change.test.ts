import { describe, expect, it } from "vitest";
import { decideTagChange } from "./tag-change";

describe("decideTagChange", () => {
  it("returns not_found for a missing memo", () => {
    expect(decideTagChange(null, "tech")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it.each(["tweet", "tech", "todo", "other"])(
    "changes a %s memo outside a group to another tag",
    (tag) => {
      const target = tag === "tech" ? "other" : "tech";
      expect(decideTagChange({ tag, groupId: null }, target)).toEqual({
        ok: true,
        unchanged: false,
      });
    },
  );

  it("reports the same tag as unchanged", () => {
    expect(decideTagChange({ tag: "tech", groupId: null }, "tech")).toEqual({
      ok: true,
      unchanged: true,
    });
  });

  it("rejects a schedule memo for every target", () => {
    for (const target of ["tweet", "tech", "todo", "other"] as const) {
      expect(
        decideTagChange({ tag: "schedule", groupId: null }, target),
      ).toEqual({ ok: false, error: "not_changeable" });
    }
  });

  it("rejects a memo in a group, even for the same tag", () => {
    expect(decideTagChange({ tag: "tweet", groupId: "g1" }, "tech")).toEqual({
      ok: false,
      error: "not_changeable",
    });
    expect(decideTagChange({ tag: "tech", groupId: "g1" }, "tech")).toEqual({
      ok: false,
      error: "not_changeable",
    });
  });

  it("rejects a schedule memo in a group", () => {
    expect(
      decideTagChange({ tag: "schedule", groupId: "g1" }, "tweet"),
    ).toEqual({ ok: false, error: "not_changeable" });
  });
});
