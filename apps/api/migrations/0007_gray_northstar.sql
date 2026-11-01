CREATE TABLE `daily_report_ai_uses` (
	`user_id` text NOT NULL,
	`used_on` text NOT NULL,
	`count` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_report_ai_uses_user_id_used_on_unique` ON `daily_report_ai_uses` (`user_id`,`used_on`);--> statement-breakpoint
CREATE TABLE `daily_report_memos` (
	`report_id` text NOT NULL,
	`memo_id` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `daily_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_report_memos_report_id_memo_id_unique` ON `daily_report_memos` (`report_id`,`memo_id`);--> statement-breakpoint
CREATE TABLE `daily_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`report_date` text NOT NULL,
	`kind` text NOT NULL,
	`framework` text NOT NULL,
	`status` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_reports_user_id_report_date_kind_unique` ON `daily_reports` (`user_id`,`report_date`,`kind`);