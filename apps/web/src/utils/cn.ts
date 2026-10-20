import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// index.css の @theme で足した文字サイズ。tailwind-merge に教えないと text-body-sm などを
// 文字色とみなし、あとに来た方だけを残す（Button の sm / xs で text-primary-foreground が消える）。
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "caption",
        "body-sm",
        "body",
        "subheading",
        "heading-sm",
        "heading",
        "heading-lg",
        "display-sm",
        "display",
        "display-lg",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
