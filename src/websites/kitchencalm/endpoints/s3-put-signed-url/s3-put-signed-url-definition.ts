import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { S3PutSignedUrlRequestSchema, S3PutSignedUrlResponseSchema } from './s3-put-signed-url.js';

export const s3PutSignedUrlRoute = createRoute({
  method: 'post',
  path: '/kitchencalm/s3/upload',
  tags: ['kitchencalm', 's3'],
  description: 'Generate a signed PUT URL for uploading files to S3',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    body: {
      content: {
        'application/json': {
          schema: S3PutSignedUrlRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: S3PutSignedUrlResponseSchema,
        },
      },
      description: 'Signed PUT URL generated successfully',
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
    401: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().describe('Error message'),
          }),
        },
      },
      description: 'Unauthorized - invalid or missing JWT token',
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
