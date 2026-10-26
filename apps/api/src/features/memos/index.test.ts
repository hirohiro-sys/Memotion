import {
  apiErrorSchema,
  createMemoRequestSchema,
  deleteMemosRequestSchema,
  MAX_BULK_DELETE,
  scheduleDateSchema,
  scheduleTimeSchema,
  setScheduleRequestSchema,
} from "@repo/shared";
import { Jwt } from "hono/utils/jwt";
import { describe, expect, it } from "vitest";
import { detectMediaType } from "./classify";
import { memoRoutes, toMemoResponse } from "./index";

const base = {
  id: "memo_1",
  tag: "tweet",
  content: "眠い",
  url: null,
  imageKey: null,
  mediaType: "text",
  source: "line",
  createdAt: "2026-09-11T00:00:00.000Z",
  groupId: null,
  scheduledDate: null,
  scheduledTime: null,
};

describe("toMemoResponse", () => {
  it("omits a null url so the web schema can parse the list", () => {
    expect(toMemoResponse(base)).toEqual({
      id: "memo_1",
      tag: "tweet",
      content: "眠い",
      mediaType: "text",
      source: "line",
      createdAt: "2026-09-11T00:00:00.000Z",
    });
  });

  it("adds a relative image path and does not read thumbnailUrl from the DB", () => {
    expect(
      toMemoResponse({
        ...base,
        tag: "other",
        content: "（画像）",
        mediaType: "image",
      }),
    ).toEqual({
      id: "memo_1",
      tag: "other",
      content: "（画像）",
      mediaType: "image",
      source: "line",
      createdAt: "2026-09-11T00:00:00.000Z",
      thumbnailUrl: "/api/memos/memo_1/image",
    });
  });

  it("keeps a present url and does not add thumbnailUrl for url memos", () => {
    expect(
      toMemoResponse({
        ...base,
        tag: "tech",
        content: "https://example.com",
        url: "https://example.com",
        mediaType: "url",
      }),
    ).toEqual({
      id: "memo_1",
      tag: "tech",
      content: "https://example.com",
      url: "https://example.com",
      mediaType: "url",
      source: "line",
      createdAt: "2026-09-11T00:00:00.000Z",
    });
  });

  it("adds a relative image path for url memos once an OGP image is stored", () => {
    expect(
      toMemoResponse({
        ...base,
        tag: "tech",
        content: "https://example.com",
        imageKey: "user_1/memo_1",
        mediaType: "url",
      }),
    ).toEqual({
      id: "memo_1",
      tag: "tech",
      content: "https://example.com",
      mediaType: "url",
      source: "line",
      createdAt: "2026-09-11T00:00:00.000Z",
      thumbnailUrl: "/api/memos/memo_1/image",
    });
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

describe("memo write routes without a session", () => {
  it("rejects create and bulk delete with 401", async () => {
    const created = await memoRoutes.request("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: "tweet", content: "眠い" }),
    });
    expect(created.status).toBe(401);

    const withClientId = await memoRoutes.request("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tag: "tweet",
        content: "眠い",
      }),
    });
    expect(withClientId.status).toBe(401);

    const deleted = await memoRoutes.request("/api/memos/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["memo_1"] }),
    });
    expect(deleted.status).toBe(401);
  });
});

describe("deleteMemosRequestSchema", () => {
  it("accepts 1 to MAX_BULK_DELETE ids", () => {
    expect(deleteMemosRequestSchema.safeParse({ ids: ["a"] }).success).toBe(
      true,
    );
    const max = Array.from({ length: MAX_BULK_DELETE }, (_, i) => `m${i}`);
    expect(deleteMemosRequestSchema.safeParse({ ids: max }).success).toBe(true);
  });

  it("rejects an empty list, too many ids, empty ids and a missing field", () => {
    expect(deleteMemosRequestSchema.safeParse({ ids: [] }).success).toBe(false);
    const over = Array.from({ length: MAX_BULK_DELETE + 1 }, (_, i) => `m${i}`);
    expect(deleteMemosRequestSchema.safeParse({ ids: over }).success).toBe(
      false,
    );
    expect(deleteMemosRequestSchema.safeParse({ ids: [""] }).success).toBe(
      false,
    );
    expect(deleteMemosRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("toMemoResponse for schedules", () => {
  it("returns the date and time of a schedule", () => {
    expect(
      toMemoResponse({
        ...base,
        tag: "schedule",
        content: "歯医者",
        source: "web",
        scheduledDate: "2026-11-03",
        scheduledTime: "14:00",
      }),
    ).toEqual({
      id: "memo_1",
      tag: "schedule",
      content: "歯医者",
      mediaType: "text",
      source: "web",
      createdAt: "2026-09-11T00:00:00.000Z",
      scheduledDate: "2026-11-03",
      scheduledTime: "14:00",
    });
  });

  it("omits the time key of an untimed schedule", () => {
    const memo = toMemoResponse({
      ...base,
      tag: "schedule",
      scheduledDate: "2026-11-03",
    });
    expect(memo.scheduledDate).toBe("2026-11-03");
    expect("scheduledTime" in memo).toBe(false);
  });

  it("omits date keys for a memo that is not a schedule", () => {
    const memo = toMemoResponse({
      ...base,
      scheduledDate: "2026-11-03",
      scheduledTime: "14:00",
    });
    expect("scheduledDate" in memo).toBe(false);
    expect("scheduledTime" in memo).toBe(false);
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

describe("setScheduleRequestSchema", () => {
  it("accepts an omitted or null time", () => {
    expect(
      setScheduleRequestSchema.parse({ scheduledDate: "2026-11-03" }),
    ).toEqual({ scheduledDate: "2026-11-03" });
    expect(
      setScheduleRequestSchema.parse({
        scheduledDate: "2026-11-03",
        scheduledTime: null,
      }),
    ).toEqual({ scheduledDate: "2026-11-03", scheduledTime: null });
  });

  it("rejects a missing date", () => {
    expect(
      setScheduleRequestSchema.safeParse({ scheduledTime: "14:00" }).success,
    ).toBe(false);
  });
});

describe("apiErrorSchema schedule codes", () => {
  it.each(["schedule_date_past", "not_schedulable"])("keeps %s", (code) => {
    expect(apiErrorSchema.parse({ message: "x", code }).code).toBe(code);
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

function putSchedule(id: string, body: string, cookie?: string) {
  return memoRoutes.request(
    `/api/memos/${id}/schedule`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
    },
    env,
  );
}

describe("PUT /api/memos/:id/schedule", () => {
  it("rejects a request without a session with 401, even with invalid JSON", async () => {
    const valid = await putSchedule(
      "memo_1",
      JSON.stringify({ scheduledDate: "2026-11-03" }),
    );
    expect(valid.status).toBe(401);
    const invalid = await putSchedule("memo_1", "{");
    expect(invalid.status).toBe(401);
  });

  it.each([
    [
      "an impossible date",
      "memo_1",
      JSON.stringify({ scheduledDate: "2026-02-30" }),
    ],
    [
      "a time without a date",
      "memo_1",
      JSON.stringify({ scheduledTime: "14:00" }),
    ],
    [
      "24:00",
      "memo_1",
      JSON.stringify({ scheduledDate: "2026-11-03", scheduledTime: "24:00" }),
    ],
    [
      "a 65-character id",
      "a".repeat(65),
      JSON.stringify({ scheduledDate: "2026-11-03" }),
    ],
    ["invalid JSON", "memo_1", "{"],
  ])("rejects %s with 400", async (_label, id, body) => {
    const res = await putSchedule(id, body, await sessionCookie());
    expect(res.status).toBe(400);
  });

  it("rejects a past date with 400 and schedule_date_past before reading the DB", async () => {
    const res = await putSchedule(
      "memo_1",
      JSON.stringify({ scheduledDate: "2000-01-01" }),
      await sessionCookie(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      message: "schedule date is past",
      code: "schedule_date_past",
    });
  });
});

describe("POST /api/memos with a schedule", () => {
  it("rejects a past date with 400 and schedule_date_past", async () => {
    const res = await memoRoutes.request(
      "/api/memos",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: await sessionCookie(),
        },
        body: JSON.stringify({
          tag: "schedule",
          scheduledDate: "2000-01-01",
          content: "x",
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("schedule_date_past");
  });
});
