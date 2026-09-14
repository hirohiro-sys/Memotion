export function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-primary" : "bg-foreground/20"
      }`}
      aria-pressed={checked}
      aria-label={checked ? "オン" : "オフ"}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-pure-white transition-transform duration-200 ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}
