import {
  apiErrorSchema,
  assignMemosRequestSchema,
  createGroupMemoRequestSchema,
  createGroupRequestSchema,
  groupIdSchema,
  MAX_BULK_DELETE,
  renameGroupRequestSchema,
} from "@repo/shared";
import { Jwt } from "hono/utils/jwt";
import { describe, expect, it } from "vitest";
import { groupRoutes } from "./index";

describe.each([
  ["createGroupRequestSchema", createGroupRequestSchema],
  ["renameGroupRequestSchema", renameGroupRequestSchema],
])("%s name", (_label, schema) => {
  it("rejects an empty name and a whitespace-only name", () => {
    expect(schema.safeParse({ name: "" }).success).toBe(false);
    expect(schema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("accepts 1 and 50 characters and rejects 51", () => {
    expect(schema.safeParse({ name: "a" }).success).toBe(true);
    expect(schema.safeParse({ name: "a".repeat(50) }).success).toBe(true);
    expect(schema.safeParse({ name: "a".repeat(51) }).success).toBe(false);
  });

  it("trims the name before saving", () => {
    expect(schema.parse({ name: "  Rust  " })).toEqual({ name: "Rust" });
  });

  it("counts the length after trimming", () => {
    expect(schema.safeParse({ name: ` ${"a".repeat(50)} ` }).success).toBe(
      true,
    );
  });
});

describe("createGroupMemoRequestSchema", () => {
  it("rejects todo and accepts tweet, tech and other", () => {
    expect(
      createGroupMemoRequestSchema.safeParse({ tag: "todo", content: "x" })
        .success,
    ).toBe(false);
    for (const tag of ["tweet", "tech", "other"]) {
      expect(
        createGroupMemoRequestSchema.safeParse({ tag, content: "x" }).success,
      ).toBe(true);
    }
  });

  it("drops extra keys such as groupId and userId, and trims content", () => {
    expect(
      createGroupMemoRequestSchema.parse({
        tag: "tweet",
        content: "  眠い  ",
        groupId: "g_other",
        userId: "u2",
      }),
    ).toEqual({ tag: "tweet", content: "眠い" });
  });

  it("rejects whitespace-only content", () => {
    expect(
      createGroupMemoRequestSchema.safeParse({ tag: "tweet", content: "  " })
        .success,
    ).toBe(false);
  });
});

describe("assignMemosRequestSchema ids", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `m_${i}`);

  it("rejects 0 ids", () => {
    expect(assignMemosRequestSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it("accepts 1 and MAX_BULK_DELETE ids", () => {
    expect(assignMemosRequestSchema.safeParse({ ids: ids(1) }).success).toBe(
      true,
    );
    expect(
      assignMemosRequestSchema.safeParse({ ids: ids(MAX_BULK_DELETE) }).success,
    ).toBe(true);
  });

  it("accepts a 64-character id and rejects a 65-character id", () => {
    expect(
      assignMemosRequestSchema.safeParse({ ids: ["a".repeat(64)] }).success,
    ).toBe(true);
    expect(
      assignMemosRequestSchema.safeParse({ ids: ["a".repeat(65)] }).success,
    ).toBe(false);
  });

  it("rejects MAX_BULK_DELETE + 1 ids", () => {
    expect(
      assignMemosRequestSchema.safeParse({ ids: ids(MAX_BULK_DELETE + 1) })
        .success,
    ).toBe(false);
  });
});

describe("groupIdSchema", () => {
  it("accepts 64 characters and rejects 65 and empty", () => {
    expect(groupIdSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(groupIdSchema.safeParse("a".repeat(65)).success).toBe(false);
    expect(groupIdSchema.safeParse("").success).toBe(false);
  });
});

describe("apiErrorSchema", () => {
  it("reads a message with a code", () => {
    expect(
      apiErrorSchema.parse({ message: "not found", code: "group_not_found" }),
    ).toEqual({ message: "not found", code: "group_not_found" });
  });

  it("reads a message without a code", () => {
    expect(apiErrorSchema.parse({ message: "oops" })).toEqual({
      message: "oops",
    });
  });

  it("reads an unknown code as no code", () => {
    const parsed = apiErrorSchema.parse({ message: "oops", code: "future" });
    expect(parsed.message).toBe("oops");
    expect(parsed.code).toBeUndefined();
  });
});

const SESSION_SECRET = "test-secret";
const env = { SESSION_SECRET };

async function sessionCookie(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await Jwt.sign(
    { sub: "user_1", iat: now, exp: now + 3600 },
    SESSION_SECRET,
    "HS256",
  );
  return `sid=${token}`;
}

function request(
  path: string,
  method: string,
  options: { cookie?: string; body?: string } = {},
) {
  return groupRoutes.request(
    path,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      ...(options.body === undefined ? {} : { body: options.body }),
    },
    env,
  );
}

const validBodies = {
  rename: JSON.stringify({ name: "Rust" }),
  memo: JSON.stringify({ tag: "tech", content: "メモ" }),
  assign: JSON.stringify({ ids: ["memo_1"] }),
};

describe("group routes without a session", () => {
  it.each([
    ["/api/groups", "GET", undefined],
    ["/api/groups", "POST", JSON.stringify({ name: "Rust" })],
    ["/api/groups/g1", "PATCH", validBodies.rename],
    ["/api/groups/g1", "DELETE", undefined],
    ["/api/groups/g1/memos", "GET", undefined],
    ["/api/groups/g1/memos", "POST", validBodies.memo],
    ["/api/groups/g1/memos/assign", "POST", validBodies.assign],
  ])("rejects %s %s with 401", async (path, method, body) => {
    const res = await request(path, method, { body });
    expect(res.status).toBe(401);
  });
});

describe("group routes with an invalid :id", () => {
  const longId = "a".repeat(65);

  it.each([
    [`/api/groups/${longId}/memos`, "GET", undefined],
    [`/api/groups/${longId}`, "PATCH", validBodies.rename],
    [`/api/groups/${longId}`, "DELETE", undefined],
    [`/api/groups/${longId}/memos`, "POST", validBodies.memo],
    [`/api/groups/${longId}/memos/assign`, "POST", validBodies.assign],
  ])("rejects %s %s with 400", async (path, method, body) => {
    const cookie = await sessionCookie();
    const res = await request(path, method, { cookie, body });
    expect(res.status).toBe(400);
  });
});

describe("group routes with an invalid body", () => {
  it.each([
    ["/api/groups", "POST", JSON.stringify({ name: "   " })],
    ["/api/groups", "POST", "{"],
    ["/api/groups/g1", "PATCH", JSON.stringify({ name: "a".repeat(51) })],
    ["/api/groups/g1", "PATCH", "{"],
    [
      "/api/groups/g1/memos",
      "POST",
      JSON.stringify({ tag: "todo", content: "買い物" }),
    ],
    ["/api/groups/g1/memos", "POST", JSON.stringify({ tag: "tech" })],
    ["/api/groups/g1/memos/assign", "POST", JSON.stringify({ ids: [] })],
    [
      "/api/groups/g1/memos/assign",
      "POST",
      JSON.stringify({
        ids: Array.from({ length: MAX_BULK_DELETE + 1 }, (_, i) => `m${i}`),
      }),
    ],
  ])("rejects %s %s %s with 400", async (path, method, body) => {
    const cookie = await sessionCookie();
    const res = await request(path, method, { cookie, body });
    expect(res.status).toBe(400);
  });
});
