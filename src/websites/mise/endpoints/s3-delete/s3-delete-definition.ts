import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { S3DeleteRequestSchema, S3DeleteResponseSchema } from './s3-delete.js';

export const s3DeleteRoute = createRoute({
  method: 'post',
  path: '/mise/s3/delete',
  tags: ['mise', 's3'],
  description: 'Delete a file from S3',
  request: {
    body: {
      content: {
        'application/json': {
          schema: S3DeleteRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: S3DeleteResponseSchema,
        },
      },
      description: 'File deleted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().describe('Error message'),
          }),
        },
      },
      description: 'Invalid request body',
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
