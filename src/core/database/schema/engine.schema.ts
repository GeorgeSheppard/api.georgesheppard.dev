import { pgTable, uuid, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const engineJobs = pgTable('engine_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: varchar('status', { length: 16 }).notNull().default('queued'),
  s3Prefix: text('s3_prefix'),
  error: text('error'),
});

export const engineServers = pgTable('engine_servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => engineJobs.id, { onDelete: 'cascade' }),
  hetznerId: text('hetzner_id'),
  status: varchar('status', { length: 16 }).notNull().default('provisioning'),
  ip: text('ip'),
  createdUtc: timestamp('created_utc', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  lastActiveUtc: timestamp('last_active_utc', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
});
