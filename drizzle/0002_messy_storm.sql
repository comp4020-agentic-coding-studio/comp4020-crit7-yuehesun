PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `activities_id_code_unique` ON `activities` (`id`,`code`);--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`activity_id` integer NOT NULL,
	`activity_code` text NOT NULL,
	`day` integer NOT NULL,
	`start_minutes` integer NOT NULL,
	`end_minutes` integer NOT NULL,
	`location` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`,`activity_code`) REFERENCES `activities`(`id`,`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "activity_id", "activity_code", "day", "start_minutes", "end_minutes", "location") SELECT "s"."id", "s"."activity_id", (SELECT "a"."code" FROM `activities` "a" WHERE "a"."id" = "s"."activity_id"), "s"."day", "s"."start_minutes", "s"."end_minutes", "s"."location" FROM `sessions` "s";--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_lecture_activity_unique` ON `sessions` (`activity_id`) WHERE "sessions"."activity_code" like 'Lec%';--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_id_activity_id_unique` ON `sessions` (`id`,`activity_id`);