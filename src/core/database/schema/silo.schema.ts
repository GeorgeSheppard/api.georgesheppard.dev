import { pgTable, uuid, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core';
import type { SiloJobResult } from '@websites/silo/types.js';

export const siloJobs = pgTable('silo_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  prompt: text('prompt').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('queued'),
  logs: jsonb('logs').$type<string[]>().notNull().default([]),
  result: jsonb('result').$type<SiloJobResult>(),
  error: text('error'),
  createdUtc: timestamp('created_utc', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedUtc: timestamp('updated_utc', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});
