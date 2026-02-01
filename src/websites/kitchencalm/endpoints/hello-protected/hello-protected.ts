import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';

export const HelloProtectedResponseSchema = z.object({
  message: z.string(),
  userId: z.string().uuid(),
  timestamp: z.string(),
});

export type HelloProtectedResponse = z.infer<typeof HelloProtectedResponseSchema>;

/**
 * Hello Protected endpoint handler
 * Receives the authenticated Hono context and returns a personalized message
 */
export async function helloProtected(c: ContextWithUserId): Promise<HelloProtectedResponse> {
  const userId = c.get('userId');

  return {
    message: 'Hello from protected endpoint!',
    userId,
    timestamp: new Date().toISOString(),
  };
}
