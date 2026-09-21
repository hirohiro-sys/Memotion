CREATE TABLE `todo_daily_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`enabled` integer NOT NULL,
	`time` text NOT NULL,
	`last_sent_at` text,
	`disabled_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todo_daily_settings_user_id_unique` ON `todo_daily_settings` (`user_id`);--> statement-breakpoint
INSERT INTO `tags` (`id`, `slug`, `name`) VALUES ('tag_todo', 'todo', 'Todo');