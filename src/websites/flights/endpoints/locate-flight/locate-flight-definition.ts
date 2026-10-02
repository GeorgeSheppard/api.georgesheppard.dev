import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { LocateFlightQuerySchema, LocateFlightResponseSchema } from './locate-flight.js';

export const locateFlightRoute = createRoute({
  method: 'get',
  path: '/flights/locate',
  tags: ['flights'],
  description:
    'Find the live aircraft flying a callsign, e.g. to show a flight search result on the map',
  request: {
    query: LocateFlightQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LocateFlightResponseSchema,
        },
      },
      description: 'The aircraft flying this callsign, or null when it is not being tracked',
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
