import { describe, expect, it } from "vitest";
import { appUserIdFor, parseAllowedLineUserIds } from "./allowlist";

describe("parseAllowedLineUserIds", () => {
  it("カンマで区切り、前後の空白と空の要素を除く", () => {
    expect([...parseAllowedLineUserIds(" U1 , U2,,U3 ,")]).toEqual([
      "U1",
      "U2",
      "U3",
    ]);
  });

  it("空か無ければ誰も含まない", () => {
    expect(parseAllowedLineUserIds("").size).toBe(0);
    expect(parseAllowedLineUserIds(undefined).size).toBe(0);
    expect(parseAllowedLineUserIds(" , ").size).toBe(0);
  });
});

describe("appUserIdFor", () => {
  const base = { allowedLineUserIds: "U_owner,U_phone", appUserId: "usr_1" };

  it("許可した LINE ユーザーは、全員が持ち主の ID になる", () => {
    expect(appUserIdFor({ ...base, lineUserId: "U_owner" })).toBe("usr_1");
    expect(appUserIdFor({ ...base, lineUserId: "U_phone" })).toBe("usr_1");
  });

  it("許可していない LINE ユーザーは null", () => {
    expect(appUserIdFor({ ...base, lineUserId: "U_other" })).toBeNull();
  });

  it("前後の空白で一致しない値も null（部分一致にしない）", () => {
    expect(appUserIdFor({ ...base, lineUserId: "U_own" })).toBeNull();
    expect(appUserIdFor({ ...base, lineUserId: " U_owner" })).toBeNull();
  });

  it("持ち主の ID が無いか空なら、許可リストにいても null", () => {
    expect(
      appUserIdFor({ ...base, appUserId: undefined, lineUserId: "U_owner" }),
    ).toBeNull();
    expect(
      appUserIdFor({ ...base, appUserId: "  ", lineUserId: "U_owner" }),
    ).toBeNull();
  });

  it("許可リストが無ければ誰も許さない", () => {
    expect(
      appUserIdFor({
        allowedLineUserIds: undefined,
        appUserId: "usr_1",
        lineUserId: "U_owner",
      }),
    ).toBeNull();
  });
});
