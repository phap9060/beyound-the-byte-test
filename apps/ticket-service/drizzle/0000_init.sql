CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`department` text NOT NULL,
	`role` text NOT NULL,
	`support_team` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kb_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`category` text NOT NULL,
	`keywords` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ticket_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` text NOT NULL,
	`at` integer NOT NULL,
	`author` text NOT NULL,
	`message` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ticket_updates_ticket_idx` ON `ticket_updates` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`affected` text NOT NULL,
	`requester_id` text NOT NULL,
	`assigned_team` text,
	`created_at` integer NOT NULL,
	`last_support_update_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`requester_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tickets_requester_idx` ON `tickets` (`requester_id`);