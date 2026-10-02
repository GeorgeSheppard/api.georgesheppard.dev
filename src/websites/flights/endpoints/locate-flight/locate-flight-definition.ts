import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { RateLimitedResponseSchema } from '@core/utils/rate-limited-error.js';
import { LocateFlightQuerySchema, LocateFlightResponseSchema } from './locate-flight.js';
import { NotImplementedResponseSchema } from '../search-flight/search-flight.js';

export const locateFlightRoute = createRoute({
  method: 'get',
  path: '/flights/locate',
  tags: ['flights'],
  description:
    'Find the live aircraft operating a searched flight. Before departure this is the aircraft flying in to operate it, if FlightAware knows which one that is',
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
      description: 'The aircraft operating this flight, or null when it cannot be found',
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
    429: {
      content: {
        'application/json': {
          schema: RateLimitedResponseSchema,
        },
      },
      description: 'An upstream provider rate limit was reached; retry after retryAfterSeconds',
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
