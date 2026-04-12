import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { deleteChatApiKey } from '../../queries/chat-api-keys.js';

export const DeleteOpenAIKeyResponseSchema = z.object({
  success: z.boolean(),
});

export type DeleteOpenAIKeyResponse = z.infer<typeof DeleteOpenAIKeyResponseSchema>;

export async function deleteOpenAIKey(c: ContextWithUserId): Promise<DeleteOpenAIKeyResponse> {
  const userId = c.get('userId');
  const { db } = c.get('databaseClient');

  await deleteChatApiKey(db, userId);

  return { success: true };
}
