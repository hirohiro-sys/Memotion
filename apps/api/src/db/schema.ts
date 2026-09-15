import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const memos = sqliteTable("memos", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "restrict" }),
  content: text("content").notNull(),
  url: text("url"),
  imageKey: text("image_key"),
  source: text("source").notNull(),
  mediaType: text("media_type").notNull(),
  lineMessageId: text("line_message_id").unique(),
  createdAt: text("created_at").notNull(),
});

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

export const usersRelations = relations(users, ({ many, one }) => ({
  memos: many(memos),
  techWeeklySettings: one(techWeeklySettings, {
    fields: [users.id],
    references: [techWeeklySettings.userId],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  memos: many(memos),
}));

export const memosRelations = relations(memos, ({ one }) => ({
  user: one(users, {
    fields: [memos.userId],
    references: [users.id],
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
