CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`last_added_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_user_id_name_unique` ON `groups` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `memos` ADD `group_id` text REFERENCES groups(id);--> statement-breakpoint
CREATE INDEX `memos_user_id_group_id_idx` ON `memos` (`user_id`,`group_id`);