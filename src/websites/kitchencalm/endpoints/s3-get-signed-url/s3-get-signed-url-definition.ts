import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { S3GetSignedUrlRequestSchema, S3GetSignedUrlResponseSchema } from './s3-get-signed-url.js';

export const s3GetSignedUrlRoute = createRoute({
  method: 'post',
  path: '/kitchencalm/s3/signed-url',
  tags: ['kitchencalm', 's3'],
  description: 'Generate a signed GET URL for downloading files from S3',
  request: {
    body: {
      content: {
        'application/json': {
          schema: S3GetSignedUrlRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: S3GetSignedUrlResponseSchema,
        },
      },
      description: 'Signed GET URL generated successfully',
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
