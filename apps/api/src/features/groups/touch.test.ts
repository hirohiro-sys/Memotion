import { describe, expect, it } from "vitest";
import { shouldTouchGroup } from "./touch";

describe("shouldTouchGroup", () => {
  it("touches when a memo was newly created in the group", () => {
    expect(shouldTouchGroup({ kind: "create", created: true })).toBe(true);
  });

  it("does not touch when a resend returned the existing memo", () => {
    expect(shouldTouchGroup({ kind: "create", created: false })).toBe(false);
  });

  it("does not touch when no memo was added", () => {
    expect(shouldTouchGroup({ kind: "assign", added: 0 })).toBe(false);
  });

  it("touches when at least one memo was added", () => {
    expect(shouldTouchGroup({ kind: "assign", added: 1 })).toBe(true);
  });
});
