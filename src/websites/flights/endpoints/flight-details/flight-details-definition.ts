import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { FlightDetailsQuerySchema, FlightDetailsResponseSchema } from './flight-details.js';

export const flightDetailsRoute = createRoute({
  method: 'get',
  path: '/flights/details',
  tags: ['flights'],
  description:
    'Get full details for a specific aircraft, combining its live position with route/airline information',
  request: {
    query: FlightDetailsQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: FlightDetailsResponseSchema,
        },
      },
      description: 'Combined position and route details for the aircraft',
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
