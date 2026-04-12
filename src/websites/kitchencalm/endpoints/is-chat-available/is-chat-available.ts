import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getChatApiKey } from '../../queries/chat-api-keys.js';

export const IsChatAvailableResponseSchema = z.object({
  available: z.boolean(),
  reason: z
    .string()
    .optional()
    .describe('Why chat is unavailable (only present when available is false)'),
});

export type IsChatAvailableResponse = z.infer<typeof IsChatAvailableResponseSchema>;

export async function isChatAvailable(c: ContextWithUserId): Promise<IsChatAvailableResponse> {
  const userId = c.get('userId');
  const { db } = c.get('databaseClient');

  const apiKey = await getChatApiKey(db, userId);
  if (!apiKey) {
    return {
      available: false,
      reason: 'No OpenAI API key configured. Add your key in settings to start chatting.',
    };
  }

  return { available: true };
}
