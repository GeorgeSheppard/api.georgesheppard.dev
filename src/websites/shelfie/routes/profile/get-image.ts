import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { findImageById } from '../../queries/recommendations.js';
import { ROUTES } from '../paths.js';

const ParamsSchema = z.object({
  imageId: z.coerce.number().int(),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.GET_PROFILE_IMAGE,
  tags: ['profile'],
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: { 'image/*': { schema: z.string().openapi({ type: 'string', format: 'binary' }) } },
      description: 'Image retrieved successfully',
    },
    404: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Image not found',
    },
  },
});

export type GetImageResult =
  | { status: 200; body: Buffer; contentType: string }
  | { status: 404; body: { error: string } };

export async function getImage(c: Context, imageId: number): Promise<GetImageResult> {
  const { db } = c.get('databaseClient');
  const image = await findImageById(db, imageId);

  if (!image) {
    return { status: 404, body: { error: 'Image not found' } };
  }

  return { status: 200, body: image.image, contentType: image.contentType };
}

export function registerGetImageRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { imageId } = c.req.valid('param');
    const result = await getImage(c, imageId);

    if (result.status === 404) {
      return c.json(result.body, 404);
    }

    return c.body(new Uint8Array(result.body), 200, { 'Content-Type': result.contentType });
  });
}
