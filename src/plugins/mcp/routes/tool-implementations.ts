import { Context } from 'hono';

/**
 * Tool implementations that have access to the Hono context.
 * These can access the database, services, and other context-bound resources.
 */

export async function handleProtectedHelloTool(c: Context) {
  // Access the authenticated user from context
  const userId = c.get('userId') as string;

  // You can also access the database:
  // const db = c.get('db');
  // const user = await db.query.users.findFirst({ where: { id: userId } });

  return {
    message: 'Hello from protected endpoint!',
    userId,
    timestamp: new Date().toISOString(),
  };
}
