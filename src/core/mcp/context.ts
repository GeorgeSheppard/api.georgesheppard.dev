import { AsyncLocalStorage } from 'async_hooks';
import { Context } from 'hono';

/**
 * AsyncLocalStorage allows us to store the Hono context
 * so that MCP tool handlers can access it.
 */
export const honoContextStorage = new AsyncLocalStorage<Context>();
