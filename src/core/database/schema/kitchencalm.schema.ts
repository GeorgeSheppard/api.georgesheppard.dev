import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const chatApiKeys = pgTable('chat_api_keys', {
  userId: text('user_id').primaryKey(),
  encryptedKey: text('encrypted_key').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});
