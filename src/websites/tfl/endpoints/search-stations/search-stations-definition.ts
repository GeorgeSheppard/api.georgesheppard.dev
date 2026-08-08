import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { SearchStationsQuerySchema, SearchStationsResponseSchema } from './search-stations.js';

export const searchStationsRoute = createRoute({
  method: 'get',
  path: '/tfl/stations',
  tags: ['tfl'],
  description: 'Search for tube stations by name',
  request: {
    query: SearchStationsQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SearchStationsResponseSchema,
        },
      },
      description: 'Matching stations',
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
