import { pgTable, uuid, text, timestamp, varchar, integer, unique } from 'drizzle-orm/pg-core';

export const engineJobs = pgTable(
  'engine_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    version: integer('version').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('queued'),
    s3Prefix: text('s3_prefix'),
    error: text('error'),
  },
  (t) => ({ projectVersion: unique('engine_jobs_project_version').on(t.projectId, t.version) })
);

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
