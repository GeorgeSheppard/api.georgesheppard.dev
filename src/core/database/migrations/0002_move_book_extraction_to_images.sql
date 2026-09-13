ALTER TABLE "images" ADD COLUMN "extracted_books" jsonb;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "processed_utc" timestamp with time zone;--> statement-breakpoint
-- Backfill: attach each request's previously-combined book list to every one of its
-- images, so recurring users keep working immediately. Duplicated across images of the
-- same request, but getExtractedBooksForRequest dedupes by title when reading it back.
UPDATE "images" AS "i"
SET "extracted_books" = "r"."books_processed" -> 'books',
    "processed_utc" = "r"."books_processed_utc"
FROM "requests" AS "r"
WHERE "i"."request_id" = "r"."id"
  AND "r"."books_processed" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN IF EXISTS "books_processed";--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN IF EXISTS "books_processed_utc";
