import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import {
  SearchFlightQuerySchema,
  SearchFlightResponseSchema,
  NotImplementedResponseSchema,
} from './search-flight.js';

export const searchFlightRoute = createRoute({
  method: 'get',
  path: '/flights/search',
  tags: ['flights'],
  description: 'Search for flights by flight number, e.g. to find where a specific plane is',
  request: {
    query: SearchFlightQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SearchFlightResponseSchema,
        },
      },
      description: 'Flights matching the given flight number',
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
    501: {
      content: {
        'application/json': {
          schema: NotImplementedResponseSchema,
        },
      },
      description: 'FlightAware is not configured yet',
    },
  },
});
