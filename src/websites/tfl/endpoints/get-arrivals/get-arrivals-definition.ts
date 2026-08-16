import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { GetArrivalsQuerySchema, GetArrivalsResponseSchema } from './get-arrivals.js';

export const getArrivalsRoute = createRoute({
  method: 'get',
  path: '/tfl/arrivals',
  tags: ['tfl'],
  description: 'Get the next arrivals for a line at a station',
  request: {
    query: GetArrivalsQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetArrivalsResponseSchema,
        },
      },
      description: 'Next arrivals for the station',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().describe('Error message'),
          }),
        },
      },
      description: 'Internal server error',
    },
  },
});
