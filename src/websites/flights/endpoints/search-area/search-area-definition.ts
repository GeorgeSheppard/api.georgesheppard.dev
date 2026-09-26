import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { SearchAreaQuerySchema, SearchAreaResponseSchema } from './search-area.js';

export const searchAreaRoute = createRoute({
  method: 'get',
  path: '/flights/area',
  tags: ['flights'],
  description: 'Get live aircraft positions within a geographical bounding box',
  request: {
    query: SearchAreaQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SearchAreaResponseSchema,
        },
      },
      description: 'Aircraft currently within the bounding box',
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
