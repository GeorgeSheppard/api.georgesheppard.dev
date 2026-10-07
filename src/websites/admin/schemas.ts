import { z } from '@hono/zod-openapi';
import { authMiddleware } from '@core/middleware/auth.js';

export const AdminErrorSchema = z.object({
  error: z.string().describe('Error message'),
});

export const adminRouteConfig = {
  tags: ['admin'],
  security: [{ apiKey: [] }],
  middleware: authMiddleware,
};

export const adminHeadersSchema = z.object({
  'x-api-key': z.string().describe('API key for authentication'),
});

export const unauthorizedResponse = {
  401: {
    content: { 'application/json': { schema: AdminErrorSchema } },
    description: 'Invalid or missing API key',
  },
};
