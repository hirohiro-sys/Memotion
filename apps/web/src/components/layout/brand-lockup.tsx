export function BrandLockup({ as: Tag = "p" }: { as?: "p" | "h1" }) {
  return (
    <Tag className="flex items-center gap-2.5 text-foreground">
      <img
        src="/memotion-mark.png"
        alt=""
        className="size-9 shrink-0 object-contain dark:invert"
      />
      <span className="text-[32px] leading-none font-bold tracking-tight">
        Memotion
      </span>
    </Tag>
  );
}
