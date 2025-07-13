CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sync_enabled` integer DEFAULT false NOT NULL,
	`sync_repo` text,
	`sync_branch` text DEFAULT 'main',
	`auto_sync` integer DEFAULT true NOT NULL,
	`sync_interval` integer DEFAULT 300,
	`filters` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_name_unique` ON `workspaces` (`name`);
--> statement-breakpoint
CREATE TABLE `realm_workspaces` (
	`realm_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`realm_id`, `workspace_id`),
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_realm_workspaces_realm` ON `realm_workspaces` (`realm_id`);
--> statement-breakpoint
CREATE INDEX `idx_realm_workspaces_workspace` ON `realm_workspaces` (`workspace_id`);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`workspace_id` text NOT NULL,
	`device_id` text NOT NULL,
	`last_sync_at` text,
	`last_sync_commit` text,
	`vector_clock` text,
	`pending_changes` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`workspace_id`, `device_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sync_state_workspace` ON `sync_state` (`workspace_id`);