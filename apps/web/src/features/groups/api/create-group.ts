import {
  createGroupRequestSchema,
  type Group,
  groupSchema,
} from "@repo/shared";
import { apiFetch } from "@/lib/api-client";
import { throwGroupApiError } from "./errors";

export async function createGroup(name: string): Promise<Group> {
  const res = await apiFetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createGroupRequestSchema.parse({ name })),
  });
  if (!res.ok) await throwGroupApiError(res, "failed to create group");
  return groupSchema.parse(await res.json());
}
