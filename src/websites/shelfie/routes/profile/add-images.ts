import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import {
  addImagesToRequest,
  createRecommendationForRequest,
} from '../../queries/recommendations.js';
import { parseMultipartFiles } from '@core/utils/multipart.js';
import type { UploadedFile } from '@core/utils/multipart.js';
import { enqueueRecommendationJob } from '@core/queue/client.js';
import { ROUTES } from '../paths.js';
import { logger } from '@core/telemetry/logger.js';

const ParamsSchema = z.object({
  requestId: z.string().uuid(),
});

const SuccessSchema = z.object({
  imagesAdded: z.number(),
  recommendationId: z.string().uuid(),
  success: z.literal(true),
});

const ErrorSchema = z.object({
  error: z.string(),
  success: z.literal(false),
});

const route = createRoute({
  method: 'post',
  path: ROUTES.ADD_PROFILE_IMAGES,
  tags: ['profile'],
  request: {
    params: ParamsSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            bookcase: z.any().openapi({
              type: 'string',
              format: 'binary',
              description: 'One or more additional bookcase images.',
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessSchema } },
      description: 'Images added and recommendations queued for regeneration',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'No files uploaded',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Failed to queue recommendation processing',
    },
  },
});

export type AddImagesResult =
  | { status: 200; body: { imagesAdded: number; recommendationId: string; success: true } }
  | { status: 400; body: { error: string; success: false } }
  | { status: 500; body: { error: string; success: false } };

export async function addImages(
  c: Context,
  requestId: string,
  files: UploadedFile[]
): Promise<AddImagesResult> {
  if (files.length === 0) {
    return { status: 400, body: { error: 'No files uploaded', success: false } };
  }

  const { db } = c.get('databaseClient');
  await addImagesToRequest(db, requestId, files);

  // Book extraction for the new images happens in the recommendation worker (see
  // extractAndStoreBooksForRequest), not here — an OpenAI vision call per image would
  // otherwise make this response wait on however long that takes.
  //
  // The user is adding photos specifically to get better recommendations, so regenerate
  // immediately against the now-larger book list rather than waiting for the next cron run.
  const recommendation = await createRecommendationForRequest(db, requestId);

  const queueClient = c.get('queueClient');
  try {
    enqueueRecommendationJob(queueClient, {
      userId: requestId,
      recommendationId: recommendation.id,
    });
  } catch (error) {
    logger.error('Failed to queue recommendation regeneration after adding images:', error);
    return {
      status: 500,
      body: { error: 'Failed to queue recommendation processing', success: false },
    };
  }

  return {
    status: 200,
    body: { imagesAdded: files.length, recommendationId: recommendation.id, success: true },
  };
}

export function registerAddImagesRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId } = c.req.valid('param');
    const files = await parseMultipartFiles(c, 'bookcase');
    const result = await addImages(c, requestId, files);

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
