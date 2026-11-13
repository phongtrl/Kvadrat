CREATE TABLE `auth_accounts` (
	`username` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`password_version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_version` integer NOT NULL,
	`expires_at` integer NOT NULL
);
