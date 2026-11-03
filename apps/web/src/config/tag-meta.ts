import type { MemoTag } from "@repo/shared";

export const TAG_ORDER: MemoTag[] = [
  "tweet",
  "tech",
  "todo",
  "schedule",
  "other",
];

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-medium transition-colors duration-200";

export const PILL_IDLE =
  "border border-border bg-card text-stone hover:text-foreground";

export const TAG_META: Record<
  MemoTag,
  {
    id: MemoTag;
    label: string;
    hashtag: string;
    description: string;
    className: string;
  }
> = {
  tweet: {
    id: "tweet",
    label: "つぶやき",
    hashtag: "#tweet",
    description: "思ったこと・つぶやき・テキストメモ",
    className: "bg-tag-tweet text-tag-tweet-fg",
  },
  tech: {
    id: "tech",
    label: "技術",
    hashtag: "#tech",
    description: "URL・技術記事・リソースの保存",
    className: "bg-tag-tech text-tag-tech-fg",
  },
  other: {
    id: "other",
    label: "その他",
    hashtag: "#other",
    description: "画像メモ・その他",
    className: "bg-tag-other text-tag-other-fg",
  },
  todo: {
    id: "todo",
    label: "やること",
    hashtag: "#todo",
    description: "やるべきこと・タスク",
    className: "bg-tag-todo text-tag-todo-fg",
  },
  schedule: {
    id: "schedule",
    label: "予定",
    hashtag: "#schedule",
    description: "日付のある予定",
    className: "bg-tag-schedule text-tag-schedule-fg",
  },
};
