import { createRoute } from '@hono/zod-openapi';
import { GetStationLinesResponseSchema } from './get-station-lines.js';

export const getStationLinesDefinition = createRoute({
  method: 'get',
  path: '/tfl/station-lines',
  tags: ['TfL'],
  description: 'Get pre-computed station lines and directions data for all tube stations',
  responses: {
    200: {
      description: 'Station lines data',
      content: {
        'application/json': {
          schema: GetStationLinesResponseSchema,
        },
      },
    },
  },
});
