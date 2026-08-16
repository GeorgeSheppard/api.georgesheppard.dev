import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { ListStationsResponseSchema } from './list-stations.js';

export const listStationsRoute = createRoute({
  method: 'get',
  path: '/tfl/stations',
  tags: ['tfl'],
  description:
    'List every tube station and the lines that serve it. Intended to be fetched once and cached client-side rather than queried per search.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListStationsResponseSchema,
        },
      },
      description: 'Every tube station with the lines serving it',
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
