import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { deleteImage as deleteImageRow } from '../../queries/recommendations.js';
import { ROUTES } from '../paths.js';

const ParamsSchema = z.object({
  requestId: z.string().uuid(),
  imageId: z.coerce.number().int(),
});

const SuccessSchema = z.object({ success: z.literal(true) });
const ErrorSchema = z.object({ error: z.string(), success: z.literal(false) });

const route = createRoute({
  method: 'delete',
  path: ROUTES.DELETE_PROFILE_IMAGE,
  tags: ['profile'],
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessSchema } },
      description: 'Image deleted successfully',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Image not found',
    },
  },
});

export type DeleteImageResult =
  | { status: 200; body: { success: true } }
  | { status: 404; body: { error: string; success: false } };

export async function deleteImage(
  c: Context,
  requestId: string,
  imageId: number
): Promise<DeleteImageResult> {
  const { db } = c.get('databaseClient');
  const deleted = await deleteImageRow(db, imageId, requestId);

  if (!deleted) {
    return { status: 404, body: { error: 'Image not found', success: false } };
  }

  return { status: 200, body: { success: true } };
}

export function registerDeleteImageRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId, imageId } = c.req.valid('param');
    const result = await deleteImage(c, requestId, imageId);

    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 404:
        return c.json(result.body, 404);
    }
  });
}
