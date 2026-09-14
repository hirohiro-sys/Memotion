import { Skeleton } from "@/components/ui/skeleton";

export function MemoCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-5 w-10" />
      </div>
    </div>
  );
}

export function MemoListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="読み込み中"
    >
      {Array.from({ length: count }, (_, index) => (
        <MemoCardSkeleton key={index} />
      ))}
    </div>
  );
}
