import { createFileRoute } from "@tanstack/react-router";
import { MemoEntry } from "@/features/memos/components/memo-entry";

export const Route = createFileRoute("/_app/")({
  component: MemoEntry,
});
