import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';

export const HelloProtectedResponseSchema = z.object({
  message: z.string(),
  userId: z.string().uuid(),
  timestamp: z.string(),
});

export type HelloProtectedResponse = z.infer<typeof HelloProtectedResponseSchema>;

export async function helloProtected(c: ContextWithUserId): Promise<HelloProtectedResponse> {
  const userId = c.get('userId');

  return {
    message: 'Hello from protected endpoint!',
    userId,
    timestamp: new Date().toISOString(),
  };
}
