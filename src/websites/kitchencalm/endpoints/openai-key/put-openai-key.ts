import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { upsertChatApiKey } from '../../queries/chat-api-keys.js';

export const PutOpenAIKeyRequestSchema = z.object({
  apiKey: z.string().min(1).describe('OpenAI API key to store'),
});

export type PutOpenAIKeyRequest = z.infer<typeof PutOpenAIKeyRequestSchema>;

export const PutOpenAIKeyResponseSchema = z.object({
  success: z.boolean(),
});

export type PutOpenAIKeyResponse = z.infer<typeof PutOpenAIKeyResponseSchema>;

export async function putOpenAIKey(
  c: ContextWithUserId,
  input: PutOpenAIKeyRequest
): Promise<PutOpenAIKeyResponse> {
  const userId = c.get('userId');
  const { db } = c.get('databaseClient');

  await upsertChatApiKey(db, userId, input.apiKey);

  return { success: true };
}
