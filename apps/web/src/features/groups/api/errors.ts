import { apiErrorSchema } from "@repo/shared";

// グループが無い（削除済み、または他人のもの）。404 の本文の code で判定する。
export class GroupNotFoundError extends Error {
  constructor() {
    super("group not found");
    this.name = "GroupNotFoundError";
  }
}

// 同じ名前のグループがすでにある（409）。
export class DuplicateGroupNameError extends Error {
  constructor() {
    super("duplicate group name");
    this.name = "DuplicateGroupNameError";
  }
}

// セッションが切れている（401）。
export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

// 失敗した応答を、呼び出し側が分岐できるエラーにして投げる。
export async function throwGroupApiError(
  res: Response,
  fallback: string,
): Promise<never> {
  if (res.status === 409) throw new DuplicateGroupNameError();
  if (res.status === 404) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success && parsed.data.code === "group_not_found") {
      throw new GroupNotFoundError();
    }
  }
  throw new Error(fallback);
}
