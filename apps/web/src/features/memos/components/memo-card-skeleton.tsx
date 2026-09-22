import { Skeleton } from "@/components/ui/skeleton";

export function MemoCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mb-2 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mt-auto flex items-center justify-end">
        <Skeleton className="h-5 w-10" />
      </div>
    </div>
  );
}

export function MemoListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="読み込み中"
    >
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <MemoCardSkeleton key={`memo-skeleton-${index}`} />
      ))}
    </div>
  );
}
