import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getOpenAIKeyForUser } from '@core/dynamodb/utilities.js';

export const GetOpenAIKeyStatusResponseSchema = z.object({
  hasKey: z.boolean(),
});

export type GetOpenAIKeyStatusResponse = z.infer<typeof GetOpenAIKeyStatusResponseSchema>;

export async function getOpenAIKeyStatus(
  c: ContextWithUserId
): Promise<GetOpenAIKeyStatusResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  const key = await getOpenAIKeyForUser(dynamoClient.client, userId);

  return { hasKey: key !== null };
}
