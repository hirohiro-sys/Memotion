const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const TIMEOUT_MS = 90_000;

export type GenerateResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "upstream" | "no_secret" };

function usableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.trim() === "") return null;
  return value;
}

// choices の本文を先に見る。無ければ旧フィールド response。reasoning は本文にしない。
export function extractModelText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const choices = record.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  if (first && typeof first === "object") {
    const message = (first as Record<string, unknown>).message;
    if (message && typeof message === "object") {
      const content = usableText((message as Record<string, unknown>).content);
      if (content) return content;
    }
  }
  return usableText(record.response);
}

function abortAsFailure(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

// バインディングの run だけを呼ぶ。応答の文字列は実行しない。
export async function generateDailyReport(
  ai: Ai | undefined,
  prompt: string,
): Promise<GenerateResult> {
  if (!ai) return { ok: false, reason: "no_secret" };
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const pending = ai.run(
    MODEL,
    {
      messages: [{ role: "user", content: prompt }],
      stream: false,
    },
    { signal },
  );
  void Promise.resolve(pending).catch(() => undefined);
  try {
    const payload = await Promise.race([pending, abortAsFailure(signal)]);
    if (signal.aborted) return { ok: false, reason: "upstream" };
    const text = extractModelText(payload);
    if (!text) return { ok: false, reason: "empty" };
    return { ok: true, text };
  } catch {
    return { ok: false, reason: "upstream" };
  }
}
