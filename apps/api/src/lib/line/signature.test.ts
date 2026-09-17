import { describe, expect, it } from "vitest";
import { verifyLineSignature } from "./signature";

const SECRET = "channel-secret";

async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  let binary = "";
  for (const byte of mac) binary += String.fromCharCode(byte);
  return btoa(binary);
}

describe("verifyLineSignature", () => {
  it("accepts HMAC-SHA256 of the raw body", async () => {
    const body = '{"events":[]}';
    const signature = await sign(body);
    await expect(
      verifyLineSignature(
        new TextEncoder().encode(body).buffer,
        signature,
        SECRET,
      ),
    ).resolves.toBe(true);
  });

  it("rejects a tampered body", async () => {
    const signature = await sign('{"events":[]}');
    await expect(
      verifyLineSignature(
        new TextEncoder().encode('{"events":[{}]}').buffer,
        signature,
        SECRET,
      ),
    ).resolves.toBe(false);
  });

  it("rejects a missing or invalid signature header", async () => {
    const body = new TextEncoder().encode('{"events":[]}').buffer;
    await expect(verifyLineSignature(body, undefined, SECRET)).resolves.toBe(
      false,
    );
    await expect(
      verifyLineSignature(body, "not-base64??", SECRET),
    ).resolves.toBe(false);
  });

  it("rejects the Login channel secret", async () => {
    const body = '{"events":[]}';
    const signature = await sign(body, "login-secret");
    await expect(
      verifyLineSignature(
        new TextEncoder().encode(body).buffer,
        signature,
        SECRET,
      ),
    ).resolves.toBe(false);
  });
});
