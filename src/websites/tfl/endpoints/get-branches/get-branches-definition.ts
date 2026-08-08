import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { GetBranchesQuerySchema, GetBranchesResponseSchema } from './get-branches.js';

export const getBranchesRoute = createRoute({
  method: 'get',
  path: '/tfl/branches',
  tags: ['tfl'],
  description:
    'Get the physical branches available from a station in a given direction, derived from ' +
    "TfL's line topology — lets a favourite be scoped to a whole branch (e.g. every station " +
    'on the Wimbledon branch) rather than one specific train destination',
  request: {
    query: GetBranchesQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetBranchesResponseSchema,
        },
      },
      description: 'Branches available from the station in that direction',
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
