import {
  apiErrorSchema,
  createMemoRequestSchema,
  scheduleDateSchema,
  scheduleTimeSchema,
} from "@repo/shared";
import { Jwt } from "hono/utils/jwt";
import { describe, expect, it } from "vitest";
import { detectMediaType } from "./classify";
import { memoRoutes } from "./index";

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

function postMemo(body: string, cookie?: string) {
  return memoRoutes.request(
    "/api/memos",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
    },
    env,
  );
}

describe("POST /api/memos without a session", () => {
  it("rejects with 401 with or without a client id, even with invalid JSON", async () => {
    expect(
      (await postMemo(JSON.stringify({ tag: "tweet", content: "眠い" })))
        .status,
    ).toBe(401);
    expect(
      (
        await postMemo(
          JSON.stringify({
            id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
            tag: "tweet",
            content: "眠い",
          }),
        )
      ).status,
    ).toBe(401);
    expect((await postMemo("{")).status).toBe(401);
  });
});

describe("POST /api/memos with a session", () => {
  it("rejects invalid JSON and an invalid body with 400 before saving", async () => {
    const cookie = await sessionCookie();
    expect((await postMemo("{", cookie)).status).toBe(400);
    expect(
      (await postMemo(JSON.stringify({ tag: "tweet", content: " " }), cookie))
        .status,
    ).toBe(400);
  });

  it("rejects a past date with 400 and schedule_date_past", async () => {
    const res = await postMemo(
      JSON.stringify({
        tag: "schedule",
        scheduledDate: "2000-01-01",
        content: "x",
      }),
      await sessionCookie(),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("schedule_date_past");
  });
});

describe("apiErrorSchema codes", () => {
  it("keeps schedule_date_past", () => {
    expect(
      apiErrorSchema.parse({ message: "x", code: "schedule_date_past" }).code,
    ).toBe("schedule_date_past");
  });

  it("reads a code it does not know as no code", () => {
    expect(
      apiErrorSchema.parse({ message: "x", code: "group_not_found" }).code,
    ).toBeUndefined();
  });
});

describe("createMemoRequestSchema", () => {
  it("keeps tag and trimmed content and drops client-supplied fields", () => {
    expect(
      createMemoRequestSchema.parse({
        tag: "tweet",
        content: "  眠い  ",
        source: "line",
        mediaType: "image",
        url: "https://example.com",
        thumbnailUrl: "/api/memos/x/image",
      }),
    ).toEqual({ tag: "tweet", content: "眠い" });
  });

  it("keeps a client UUID v4 id and the written time but still drops unknown fields", () => {
    expect(
      createMemoRequestSchema.parse({
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tag: "tweet",
        content: "眠い",
        createdAt: "2026-10-17T09:00:00+09:00",
        userId: "user_2",
      }),
    ).toEqual({
      id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      tag: "tweet",
      content: "眠い",
      createdAt: "2026-10-17T09:00:00+09:00",
    });
  });

  it("rejects an id that is not a UUID v4", () => {
    expect(
      createMemoRequestSchema.safeParse({
        id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        tag: "tweet",
        content: "眠い",
      }).success,
    ).toBe(false);
    expect(
      createMemoRequestSchema.safeParse({
        id: "memo_1",
        tag: "tweet",
        content: "眠い",
      }).success,
    ).toBe(false);
  });

  it("rejects a written time without an offset, a date only, or free text", () => {
    for (const createdAt of [
      "2026-10-17T09:00:00",
      "2026-10-17",
      "yesterday",
    ]) {
      expect(
        createMemoRequestSchema.safeParse({
          tag: "tweet",
          content: "眠い",
          createdAt,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects whitespace-only content", () => {
    expect(() =>
      createMemoRequestSchema.parse({ tag: "tech", content: "   " }),
    ).toThrow();
  });

  it("accepts the todo tag", () => {
    expect(
      createMemoRequestSchema.parse({ tag: "todo", content: "買う" }),
    ).toEqual({ tag: "todo", content: "買う" });
  });

  it("rejects an unknown tag", () => {
    expect(() =>
      createMemoRequestSchema.parse({ tag: "work", content: "買う" }),
    ).toThrow();
  });
});

describe("detectMediaType", () => {
  it("treats a bare URL as url", () => {
    expect(detectMediaType("https://example.com/path?q=1")).toBe("url");
    expect(detectMediaType("http://example.com")).toBe("url");
  });

  it("treats prose, prose plus a URL, and whitespace-padded text as text", () => {
    expect(detectMediaType("眠い")).toBe("text");
    expect(detectMediaType("これ見て https://example.com")).toBe("text");
  });
});

describe("scheduleDateSchema", () => {
  it.each(["2026-11-03", "2028-02-29", "9999-12-31"])("accepts %s", (date) => {
    expect(scheduleDateSchema.safeParse(date).success).toBe(true);
  });

  it.each(["2026-2-3", "2026-02-30", "2027-02-29", "2026-13-01", ""])(
    "rejects %s",
    (date) => {
      expect(scheduleDateSchema.safeParse(date).success).toBe(false);
    },
  );
});

describe("scheduleTimeSchema", () => {
  it.each(["00:00", "09:00", "23:59"])("accepts %s", (time) => {
    expect(scheduleTimeSchema.safeParse(time).success).toBe(true);
  });

  it.each(["24:00", "12:60", "9:00", "12:5", "aa:bb", "12:00:00"])(
    "rejects %s",
    (time) => {
      expect(scheduleTimeSchema.safeParse(time).success).toBe(false);
    },
  );
});

describe("createMemoRequestSchema for schedules", () => {
  const schedule = {
    tag: "schedule",
    content: "歯医者",
    scheduledDate: "2026-11-03",
  };

  it("requires a date for a schedule", () => {
    expect(
      createMemoRequestSchema.safeParse({ tag: "schedule", content: "歯医者" })
        .success,
    ).toBe(false);
    expect(createMemoRequestSchema.parse(schedule)).toEqual(schedule);
  });

  it("accepts an omitted, null or valid time", () => {
    expect(
      createMemoRequestSchema.parse({ ...schedule, scheduledTime: null }),
    ).toEqual({ ...schedule, scheduledTime: null });
    expect(
      createMemoRequestSchema.parse({ ...schedule, scheduledTime: "14:00" }),
    ).toEqual({ ...schedule, scheduledTime: "14:00" });
  });

  it("rejects an impossible date and 24:00", () => {
    expect(
      createMemoRequestSchema.safeParse({
        ...schedule,
        scheduledDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      createMemoRequestSchema.safeParse({ ...schedule, scheduledTime: "24:00" })
        .success,
    ).toBe(false);
  });

  it("rejects whitespace-only content even with a date", () => {
    expect(
      createMemoRequestSchema.safeParse({ ...schedule, content: "   " })
        .success,
    ).toBe(false);
  });

  it.each(["tweet", "tech", "todo", "other"])("rejects a date on %s", (tag) => {
    expect(
      createMemoRequestSchema.safeParse({
        tag,
        content: "x",
        scheduledDate: "2026-11-03",
      }).success,
    ).toBe(false);
  });

  it.each(["tweet", "schedule"])(
    "rejects a time without a date on %s",
    (tag) => {
      expect(
        createMemoRequestSchema.safeParse({
          tag,
          content: "x",
          scheduledTime: "14:00",
        }).success,
      ).toBe(false);
    },
  );
});
