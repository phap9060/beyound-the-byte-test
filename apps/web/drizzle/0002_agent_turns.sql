CREATE TABLE `agent_turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`employee_message_id` integer NOT NULL,
	`reply_message_id` integer,
	`outcome` text NOT NULL,
	`intent` text,
	`confidence` real,
	`handoff_reasons` text,
	`priority` text,
	`tool_calls` text,
	`steps` text,
	`trace` text,
	`error` text,
	`duration_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reply_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_turns_conversation_idx` ON `agent_turns` (`conversation_id`);