CREATE TABLE `schedule_daily_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`enabled` integer NOT NULL,
	`time` text NOT NULL,
	`last_target_date` text,
	`disabled_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_daily_settings_user_id_unique` ON `schedule_daily_settings` (`user_id`);--> statement-breakpoint
ALTER TABLE `memos` ADD `scheduled_date` text;--> statement-breakpoint
ALTER TABLE `memos` ADD `scheduled_time` text;--> statement-breakpoint
CREATE INDEX `memos_user_id_scheduled_date_idx` ON `memos` (`user_id`,`scheduled_date`);--> statement-breakpoint
INSERT INTO `tags` (`id`, `slug`, `name`) VALUES ('tag_schedule', 'schedule', 'Schedule');