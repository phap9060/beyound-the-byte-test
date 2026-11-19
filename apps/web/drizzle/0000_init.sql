CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`employee_email` text NOT NULL,
	`employee_department` text NOT NULL,
	`status` text NOT NULL,
	`handoff_reasons` text,
	`handoff_summary` text,
	`handoff_team` text,
	`agent_confidence` real,
	`linked_ticket_id` text,
	`assigned_analyst_id` text,
	`assigned_analyst_name` text,
	`closed_by` text,
	`handed_off_at` integer,
	`waiting_until` integer,
	`assigned_at` integer,
	`closed_at` integer,
	`last_message_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversations_employee_idx` ON `conversations` (`employee_id`);--> statement-breakpoint
CREATE INDEX `conversations_status_idx` ON `conversations` (`status`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`author` text NOT NULL,
	`author_id` text,
	`author_name` text,
	`author_team` text,
	`text` text NOT NULL,
	`parts` text,
	`steps` text,
	`session_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`);