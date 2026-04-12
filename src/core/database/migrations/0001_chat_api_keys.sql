CREATE TABLE IF NOT EXISTS "chat_api_keys" (
	"user_id" text PRIMARY KEY NOT NULL,
	"encrypted_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
