CREATE TABLE `facts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content` text NOT NULL,
	`why` text,
	`type` text NOT NULL,
	`services` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`confidence` integer DEFAULT 80 NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_facts_project_id` ON `facts` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_facts_type` ON `facts` (`type`);--> statement-breakpoint
CREATE INDEX `idx_facts_status` ON `facts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_facts_content` ON `facts` (`content`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`git_remote` text,
	`is_monorepo` integer DEFAULT false NOT NULL,
	`services` text DEFAULT '[]' NOT NULL,
	`last_seen` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_path_unique` ON `projects` (`path`);--> statement-breakpoint
CREATE TABLE `relations` (
	`from_fact_id` text NOT NULL,
	`to_fact_id` text NOT NULL,
	`type` text NOT NULL,
	`strength` real DEFAULT 1 NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`from_fact_id`, `to_fact_id`, `type`),
	FOREIGN KEY (`from_fact_id`) REFERENCES `facts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_fact_id`) REFERENCES `facts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_relations_from` ON `relations` (`from_fact_id`);--> statement-breakpoint
CREATE INDEX `idx_relations_to` ON `relations` (`to_fact_id`);