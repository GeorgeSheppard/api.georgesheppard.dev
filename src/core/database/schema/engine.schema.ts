import { pgTable, uuid, text, varchar } from 'drizzle-orm/pg-core';

export const engineJobs = pgTable('engine_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: varchar('status', { length: 16 }).notNull().default('queued'),
  s3Prefix: text('s3_prefix'),
  error: text('error'),
});
