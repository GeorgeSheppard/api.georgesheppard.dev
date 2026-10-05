import { z } from '@hono/zod-openapi';

export const AdminErrorSchema = z.object({
  error: z.string().describe('Error message'),
});

export const adminErrorResponses = {
  401: {
    content: { 'application/json': { schema: AdminErrorSchema } },
    description: 'Missing or invalid Cloudflare Access token',
  },
  403: {
    content: { 'application/json': { schema: AdminErrorSchema } },
    description: 'Authenticated email is not an allowed admin',
  },
  404: {
    content: { 'application/json': { schema: AdminErrorSchema } },
    description: 'Admin portal is not configured, or the resource was not found',
  },
};
