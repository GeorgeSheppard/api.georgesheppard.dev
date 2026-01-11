import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { recommendations, requests, images } from '@core/database/schema/index.js';
import { parseMultipartFiles } from '@core/utils/multipart.js';
import { ROUTES } from '../paths.js';

const SuccessResponse = z.object({
  id: z.string().uuid(),
  success: z.literal(true)
});

const ErrorResponse = z.object({
  error: z.string(),
  success: z.literal(false)
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
              description: 'One or more bookcase images. Multiple files can be uploaded with the same field name.'
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

export function registerFromBookcaseRoute(app: OpenAPIHono) {
  app.openapi(
    route,
    async (c) => {
      const files = await parseMultipartFiles(c, 'bookcase');

      if (files.length === 0) {
        return c.json({ error: 'No files uploaded', success: false }, 400);
      }

      const { db } = c.get('databaseClient');
      const ipLocator = c.get('ipLocator');
      const forwardedFor = c.req.header('x-forwarded-for');
      const location = await ipLocator.getLocation(forwardedFor);

      const { newRequest, recommendation } = await db.transaction(async (tx) => {
        const [newRequest] = await tx
          .insert(requests)
          .values({
            createdUtc: new Date(),
            location: location.toString(),
          })
          .returning();

        const [recommendationResults] = await Promise.all([
          tx.insert(recommendations).values({
            requestId: newRequest.id,
          }).returning(),
          tx.insert(images).values(
            files.map((file) => ({
              requestId: newRequest.id,
              image: file.data,
              contentType: file.mimetype,
            }))
          ),
        ]);

        const [recommendation] = recommendationResults;

        return { newRequest, recommendation };
      });

      const queueClient = c.get('queueClient');
      try {
        queueClient.channel.sendToQueue(
          queueClient.textExtractionQueue,
          Buffer.from(JSON.stringify({ userId: newRequest.id, recommendationId: recommendation.id })),
          { persistent: true }
        );
      } catch (error) {
        console.error('Failed to send queue message:', error);
        return c.json(
          { error: 'Failed to queue recommendation processing', success: false },
          500
        );
      }

      return c.json({ id: recommendation.id, success: true }, 200);
    }
  );
}
