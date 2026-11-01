import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDailyReport } from "./client";

afterEach(() => {
  vi.restoreAllMocks();
});

function binding(run: ReturnType<typeof vi.fn>): Ai {
  return { run } as unknown as Ai;
}

describe("generateDailyReport", () => {
  it("calls the fixed model with stream false and a 90 second abort", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const run = vi.fn(async () => ({
      choices: [{ message: { content: "本文" } }],
      response: "legacy",
      reasoning: "think",
    }));
    const result = await generateDailyReport(binding(run), "材料");
    expect(result).toEqual({ ok: true, text: "本文" });
    expect(timeout).toHaveBeenCalledWith(90_000);
    expect(run).toHaveBeenCalledWith(
      "@cf/google/gemma-4-26b-a4b-it",
      { messages: [{ role: "user", content: "材料" }], stream: false },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not call run when the binding is missing", async () => {
    const run = vi.fn();
    const result = await generateDailyReport(undefined, "材料");
    expect(result).toEqual({ ok: false, reason: "no_secret" });
    expect(run).not.toHaveBeenCalled();
  });

  it("uses response when content is empty and ignores reasoning", async () => {
    const run = vi.fn(async () => ({
      choices: [{ message: { content: "" } }],
      response: "本文",
      reasoning: "think",
    }));
    const result = await generateDailyReport(binding(run), "材料");
    expect(result).toEqual({ ok: true, text: "本文" });
  });

  it("returns empty when content, response, and a reasoning-only payload have no text", async () => {
    const blank = vi.fn(async () => ({
      choices: [{ message: { content: "  " } }],
      response: "\n",
      reasoning: "think",
    }));
    const reasoningOnly = vi.fn(async () => ({ reasoning: "think" }));
    expect(await generateDailyReport(binding(blank), "材料")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(await generateDailyReport(binding(reasoningOnly), "材料")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("returns upstream when the call fails", async () => {
    const run = vi.fn(async () => {
      throw new Error("workers ai 500");
    });
    const result = await generateDailyReport(binding(run), "材料");
    expect(result).toEqual({ ok: false, reason: "upstream" });
  });

  it("returns upstream when the abort fires before a response", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    const run = vi.fn(() => new Promise(() => undefined));
    const result = await generateDailyReport(binding(run), "材料");
    expect(result).toEqual({ ok: false, reason: "upstream" });
  });
});
