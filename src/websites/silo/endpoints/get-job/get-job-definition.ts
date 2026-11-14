import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { GetJobParamsSchema, GetJobResponseSchema } from './get-job.js';

const ErrorSchema = z.object({ error: z.string().describe('Error message') });

export const getJobRoute = createRoute({
  method: 'get',
  path: '/silo/jobs/{id}',
  tags: ['silo'],
  description: 'Get the status, progress log and result of a generation job',
  request: { params: GetJobParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: GetJobResponseSchema } },
      description: 'Job found',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Origin not allowed',
    },
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Job not found' },
  },
});
