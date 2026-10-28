CREATE TABLE `connpass_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`memo_id` text,
	`imported_title` text NOT NULL,
	`imported_date` text NOT NULL,
	`imported_time` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connpass_imports_user_id_event_id_unique` ON `connpass_imports` (`user_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `connpass_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nickname` text NOT NULL,
	`last_synced_at` text,
	`last_sync_status` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connpass_settings_user_id_unique` ON `connpass_settings` (`user_id`);