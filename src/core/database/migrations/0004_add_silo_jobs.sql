CREATE TABLE IF NOT EXISTS "silo_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt" text NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"created_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_utc" timestamp with time zone DEFAULT now() NOT NULL
);
