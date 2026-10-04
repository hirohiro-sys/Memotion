export function BrandLockup({
  as: Tag = "p",
  markOnly = false,
}: {
  as?: "p" | "h1";
  markOnly?: boolean;
}) {
  return (
    <Tag className="flex items-center gap-2.5 text-foreground">
      <img
        src="/memotion-mark.png"
        alt={markOnly ? "Memotion" : ""}
        title={markOnly ? "Memotion" : undefined}
        className="size-9 shrink-0 object-contain dark:invert"
      />
      {markOnly ? null : (
        <span className="text-[32px] leading-none font-bold tracking-tight">
          Memotion
        </span>
      )}
    </Tag>
  );
}
