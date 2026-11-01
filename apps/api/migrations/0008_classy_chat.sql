PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_daily_report_ai_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`used_on` text NOT NULL,
	`count` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_daily_report_ai_uses`("id", "user_id", "used_on", "count") SELECT lower(hex(randomblob(16))), "user_id", "used_on", "count" FROM `daily_report_ai_uses`;--> statement-breakpoint
DROP TABLE `daily_report_ai_uses`;--> statement-breakpoint
ALTER TABLE `__new_daily_report_ai_uses` RENAME TO `daily_report_ai_uses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `daily_report_ai_uses_user_id_used_on_unique` ON `daily_report_ai_uses` (`user_id`,`used_on`);--> statement-breakpoint
CREATE TABLE `__new_daily_report_memos` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`memo_id` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `daily_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_daily_report_memos`("id", "report_id", "memo_id") SELECT lower(hex(randomblob(16))), "report_id", "memo_id" FROM `daily_report_memos`;--> statement-breakpoint
DROP TABLE `daily_report_memos`;--> statement-breakpoint
ALTER TABLE `__new_daily_report_memos` RENAME TO `daily_report_memos`;--> statement-breakpoint
CREATE UNIQUE INDEX `daily_report_memos_report_id_memo_id_unique` ON `daily_report_memos` (`report_id`,`memo_id`);