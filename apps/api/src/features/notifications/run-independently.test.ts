import { describe, expect, it } from "vitest";
import { runIndependently } from "./run-independently";

describe("runIndependently", () => {
  it("runs the rest after one task throws and returns the failed names", async () => {
    const ran: string[] = [];
    const result = await runIndependently([
      { name: "a", run: async () => void ran.push("a") },
      {
        name: "b",
        run: async () => {
          throw new Error("boom");
        },
      },
      { name: "c", run: async () => void ran.push("c") },
    ]);
    expect(ran).toEqual(["a", "c"]);
    expect(result).toEqual({ failed: ["b"] });
  });

  it("reports no failures when every task succeeds", async () => {
    const result = await runIndependently([
      { name: "a", run: async () => {} },
      { name: "b", run: async () => {} },
    ]);
    expect(result).toEqual({ failed: [] });
  });
});
