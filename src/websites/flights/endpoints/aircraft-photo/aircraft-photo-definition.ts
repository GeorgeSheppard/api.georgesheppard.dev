import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { AircraftPhotoQuerySchema, AircraftPhotoResponseSchema } from './aircraft-photo.js';

export const aircraftPhotoRoute = createRoute({
  method: 'get',
  path: '/flights/photo',
  tags: ['flights'],
  description: 'Get a photo of a specific aircraft from Planespotters.net, with its attribution',
  request: {
    query: AircraftPhotoQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AircraftPhotoResponseSchema,
        },
      },
      description: 'The aircraft photo, or null when none is available',
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
