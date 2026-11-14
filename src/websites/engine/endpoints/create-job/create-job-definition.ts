import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { CreateJobRequestSchema, CreateJobResponseSchema } from './create-job.js';

const ErrorSchema = z.object({ error: z.string().describe('Error message') });

export const createJobRoute = createRoute({
  method: 'post',
  path: '/engine/jobs',
  tags: ['engine'],
  description: 'Generate a Minecraft plugin from a description, or change an existing project',
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
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Project not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'The project is still being built',
    },
    429: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Too many jobs or servers in use',
    },
  },
});
