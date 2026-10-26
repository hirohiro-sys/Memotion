import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  lineUserId: text("line_user_id").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
    lastAddedAt: text("last_added_at").notNull(),
  },
  (t) => [unique("groups_user_id_name_unique").on(t.userId, t.name)],
);

export const memos = sqliteTable(
  "memos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "restrict",
    }),
    content: text("content").notNull(),
    url: text("url"),
    imageKey: text("image_key"),
    source: text("source").notNull(),
    mediaType: text("media_type").notNull(),
    lineMessageId: text("line_message_id").unique(),
    createdAt: text("created_at").notNull(),
    ogpState: text("ogp_state"),
    ogpClaimedAt: text("ogp_claimed_at"),
    // 予定（tag: schedule）の日付（YYYY-MM-DD）と時刻（HH:MM）。JST。予定以外は NULL。
    scheduledDate: text("scheduled_date"),
    scheduledTime: text("scheduled_time"),
  },
  (t) => [
    index("memos_user_id_group_id_idx").on(t.userId, t.groupId),
    index("memos_user_id_scheduled_date_idx").on(t.userId, t.scheduledDate),
  ],
);

export const techWeeklySettings = sqliteTable("tech_weekly_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "restrict" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  weekday: integer("weekday").notNull(),
  time: text("time").notNull(),
  lastSentAt: text("last_sent_at"),
  disabledReason: text("disabled_reason"),
});

export const todoDailySettings = sqliteTable("todo_daily_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "restrict" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  time: text("time").notNull(),
  lastSentAt: text("last_sent_at"),
  disabledReason: text("disabled_reason"),
});

// 予定の前日通知。二重送信を防ぐため、送った時刻ではなく最後に処理した対象日を持つ。
export const scheduleDailySettings = sqliteTable("schedule_daily_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "restrict" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  time: text("time").notNull(),
  lastTargetDate: text("last_target_date"),
  disabledReason: text("disabled_reason"),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  memos: many(memos),
  groups: many(groups),
  techWeeklySettings: one(techWeeklySettings, {
    fields: [users.id],
    references: [techWeeklySettings.userId],
  }),
  todoDailySettings: one(todoDailySettings, {
    fields: [users.id],
    references: [todoDailySettings.userId],
  }),
  scheduleDailySettings: one(scheduleDailySettings, {
    fields: [users.id],
    references: [scheduleDailySettings.userId],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  memos: many(memos),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  user: one(users, {
    fields: [groups.userId],
    references: [users.id],
  }),
  memos: many(memos),
}));

export const memosRelations = relations(memos, ({ one }) => ({
  user: one(users, {
    fields: [memos.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [memos.groupId],
    references: [groups.id],
  }),
  tag: one(tags, {
    fields: [memos.tagId],
    references: [tags.id],
  }),
}));

export const techWeeklySettingsRelations = relations(
  techWeeklySettings,
  ({ one }) => ({
    user: one(users, {
      fields: [techWeeklySettings.userId],
      references: [users.id],
    }),
  }),
);

export const todoDailySettingsRelations = relations(
  todoDailySettings,
  ({ one }) => ({
    user: one(users, {
      fields: [todoDailySettings.userId],
      references: [users.id],
    }),
  }),
);

export const scheduleDailySettingsRelations = relations(
  scheduleDailySettings,
  ({ one }) => ({
    user: one(users, {
      fields: [scheduleDailySettings.userId],
      references: [users.id],
    }),
  }),
);
