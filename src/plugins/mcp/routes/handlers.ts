import { Context } from 'hono';
import { handleProtectedHelloTool } from './tool-implementations.js';

/**
 * HTTP route handlers - These wrap the tool implementations
 * and format the response as JSON for HTTP clients.
 */

export async function handleProtectedHello(c: Context) {
  const data = await handleProtectedHelloTool(c);
  return c.json(data, 200);
}
