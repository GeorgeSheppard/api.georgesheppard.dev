import { Context } from 'hono';

/**
 * Env type for protected routes that require authentication
 * This ensures userId is available in the context
 */
export type ProtectedEnv = {
  Variables: {
    userId: string;
  };
};

/**
 * Context type for handlers that are protected by jwtAuthMiddleware
 */
export type ContextWithUserId = Context<ProtectedEnv>;
