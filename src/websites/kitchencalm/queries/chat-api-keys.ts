import { eq } from 'drizzle-orm';
import { chatApiKeys } from '@core/database/schema/kitchencalm.schema.js';
import { encryption } from '@core/utils/encryption.js';
import type { DatabaseClient } from '@core/database/client.js';

export async function getChatApiKey(
  db: DatabaseClient['db'],
  userId: string
): Promise<string | null> {
  const result = await db
    .select({ encryptedKey: chatApiKeys.encryptedKey })
    .from(chatApiKeys)
    .where(eq(chatApiKeys.userId, userId))
    .limit(1);

  if (!result[0]) return null;
  return encryption.decrypt(result[0].encryptedKey);
}

export async function upsertChatApiKey(
  db: DatabaseClient['db'],
  userId: string,
  apiKey: string
): Promise<void> {
  const encryptedKey = encryption.encrypt(apiKey);
  await db
    .insert(chatApiKeys)
    .values({ userId, encryptedKey })
    .onConflictDoUpdate({
      target: chatApiKeys.userId,
      set: { encryptedKey, updatedAt: new Date() },
    });
}

export async function deleteChatApiKey(db: DatabaseClient['db'], userId: string): Promise<void> {
  await db.delete(chatApiKeys).where(eq(chatApiKeys.userId, userId));
}
