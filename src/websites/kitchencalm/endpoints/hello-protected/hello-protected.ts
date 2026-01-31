import { Context } from 'hono';
import { HelloProtectedResponse } from './hello-protected-definition.js';

/**
 * Hello Protected endpoint handler
 * Receives the authenticated Hono context and returns a personalized message
 */
export async function helloProtected(c: Context): Promise<HelloProtectedResponse> {
  const userId = c.get('userId') as string;

  return {
    message: 'Hello from protected endpoint!',
    userId,
    timestamp: new Date().toISOString(),
  };
}
