CREATE TABLE IF NOT EXISTS "engine_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"s3_prefix" text,
	"error" text,
	CONSTRAINT "engine_jobs_project_version" UNIQUE("project_id","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"hetzner_id" text,
	"status" varchar(16) DEFAULT 'provisioning' NOT NULL,
	"ip" text,
	"created_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "engine_servers" ADD CONSTRAINT "engine_servers_job_id_engine_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."engine_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
