import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { CreateJobRequestSchema, CreateJobResponseSchema } from './create-job.js';

const ErrorSchema = z.object({ error: z.string().describe('Error message') });

export const createJobRoute = createRoute({
  method: 'post',
  path: '/silo/jobs',
  tags: ['silo'],
  description: 'Start generating a Minecraft plugin from a description',
  request: {
    body: { content: { 'application/json': { schema: CreateJobRequestSchema } }, required: true },
  },
  responses: {
    202: {
      content: { 'application/json': { schema: CreateJobResponseSchema } },
      description: 'Job queued',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Origin not allowed',
    },
    429: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Too many jobs in progress',
    },
  },
});
