CREATE TABLE IF NOT EXISTS "engine_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"s3_prefix" text,
	"error" text
);
