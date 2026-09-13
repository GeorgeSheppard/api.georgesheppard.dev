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
import type { Recommendation, BookEntry } from '@core/types/recommendation.js';

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
  location: text('location').notNull().default('Us'),
  nextRecommendationUtc: timestamp('next_recommendation_utc', { mode: 'date', withTimezone: true }),
  frequency: varchar('frequency', { length: 4 }),
  customPreferences: text('custom_preferences'),
});

// images table (BookcaseImage)
export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => requests.id, { onDelete: 'cascade' }),
  image: bytea('image').notNull(),
  contentType: text('content_type').notNull(),
  extractedBooks: jsonb('extracted_books').$type<BookEntry[]>(),
  processedUtc: timestamp('processed_utc', { mode: 'date', withTimezone: true }),
  // A capability separate from requestId for viewing this one image: requestId also grants
  // write access to the whole profile (add/delete images, preferences), so it should never be
  // the only thing standing between an <img src> URL leaking and someone controlling the profile.
  accessToken: uuid('access_token').notNull().defaultRandom(),
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
