import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  serial,
  varchar,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { Recommendation, BooksProcessed } from '@core/types/recommendation.js';

// Custom bytea type for binary data
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
});

// requests table (User entity in .NET)
export const requests = pgTable('requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  createdUtc: timestamp('created_utc', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  booksProcessed: jsonb('books_processed').$type<BooksProcessed>(),
  booksProcessedUtc: timestamp('books_processed_utc', { mode: 'date', withTimezone: true }),
  location: text('location').notNull().default('Us'),
  nextRecommendationUtc: timestamp('next_recommendation_utc', { mode: 'date', withTimezone: true }),
  frequency: varchar('frequency', { length: 4 }),
});

// images table (BookcaseImage)
export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => requests.id, { onDelete: 'cascade' }),
  image: bytea('image').notNull(),
  contentType: text('content_type').notNull(),
});

// recommendations table (BookRecommendations)
export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => requests.id, { onDelete: 'cascade' }),
  recommendations: jsonb('recommendations').$type<Recommendation[]>(),
  processedUtc: timestamp('processed_utc', { mode: 'date', withTimezone: true }),
});

// Relations for querying
export const requestsRelations = relations(requests, ({ many }) => ({
  images: many(images),
  recommendations: many(recommendations),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  request: one(requests, {
    fields: [images.requestId],
    references: [requests.id],
  }),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  request: one(requests, {
    fields: [recommendations.requestId],
    references: [requests.id],
  }),
}));
