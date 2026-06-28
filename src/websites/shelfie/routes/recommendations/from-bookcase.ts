import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { createBookcaseRequest, updateBooksProcessed } from '../../queries/recommendations.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';
import { parseMultipartFiles } from '@core/utils/multipart.js';
import type { UploadedFile } from '@core/utils/multipart.js';
import { ROUTES } from '../paths.js';
import { logger } from '@core/telemetry/logger.js';

const SuccessResponse = z.object({
  id: z.string().uuid(),
  success: z.literal(true),
});

const ErrorResponse = z.object({
  error: z.string(),
  success: z.literal(false),
});

const route = createRoute({
  method: 'post',
  path: ROUTES.FROM_BOOKCASE,
  tags: ['recommendations'],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            bookcase: z.any().openapi({
              type: 'string',
              format: 'binary',
              description:
                'One or more bookcase images. Multiple files can be uploaded with the same field name.',
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Recommendation request created successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'No files uploaded',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Failed to queue recommendation processing',
    },
  },
});

export type FromBookcaseSuccess = { id: string; success: true };
export type FromBookcaseError = { error: string; success: false };

export type FromBookcaseResult =
  | { status: 200; body: FromBookcaseSuccess }
  | { status: 400; body: FromBookcaseError }
  | { status: 500; body: FromBookcaseError };

export async function fromBookcase(
  c: Context,
  files: UploadedFile[],
  forwardedFor: string | undefined
): Promise<FromBookcaseResult> {
  if (files.length === 0) {
    return { status: 400, body: { error: 'No files uploaded', success: false } };
  }

  const { db } = c.get('databaseClient');
  const ipLocator = c.get('ipLocator');
  const location = await ipLocator.getLocation(forwardedFor);

  const { newRequest, recommendation } = await createBookcaseRequest(
    db,
    location.toString(),
    files
  );

  const openaiClient = c.get('openaiClient');
  const books = await extractBooksFromImages(
    files.map((file) => ({ buffer: file.data, contentType: file.mimetype })),
    openaiClient.getClient()
  );
  await updateBooksProcessed(db, newRequest.id, books);

  const queueClient = c.get('queueClient');
  try {
    queueClient.channel.sendToQueue(
      queueClient.recommendationQueue,
      Buffer.from(JSON.stringify({ userId: newRequest.id, recommendationId: recommendation.id })),
      { persistent: true }
    );
  } catch (error) {
    logger.error('Failed to send queue message:', error);
    return {
      status: 500,
      body: { error: 'Failed to queue recommendation processing', success: false },
    };
  }

  return { status: 200, body: { id: recommendation.id, success: true } };
}

export function registerFromBookcaseRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const files = await parseMultipartFiles(c, 'bookcase');
    const forwardedFor = c.req.header('x-forwarded-for');
    const result = await fromBookcase(c, files, forwardedFor);

    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 400:
        return c.json(result.body, 400);
      case 500:
        return c.json(result.body, 500);
    }
  });
}
