import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { findImageByAccessToken } from '../../queries/recommendations.js';
import { ROUTES } from '../paths.js';

const ParamsSchema = z.object({
  imageId: z.string().regex(/^\d+$/).openapi({ type: 'integer' }),
  accessToken: z.string().uuid(),
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

export async function getImage(
  c: Context,
  imageId: number,
  accessToken: string
): Promise<GetImageResult> {
  const { db } = c.get('databaseClient');
  const image = await findImageByAccessToken(db, imageId, accessToken);

  if (!image) {
    return { status: 404, body: { error: 'Image not found' } };
  }

  return { status: 200, body: image.image, contentType: image.contentType };
}

export function registerGetImageRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { imageId, accessToken } = c.req.valid('param');
    const result = await getImage(c, Number(imageId), accessToken);

    if (result.status === 404) {
      return c.json(result.body, 404);
    }

    // This URL carries a bearer capability (the accessToken) — never let it be cached by a
    // shared/proxy cache or leak onward via a Referer header to another origin.
    return c.body(new Uint8Array(result.body), 200, {
      'Content-Type': result.contentType,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    });
  });
}
