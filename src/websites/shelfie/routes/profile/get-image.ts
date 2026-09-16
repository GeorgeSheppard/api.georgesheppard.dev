import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { findImageByIdForRequest } from '../../queries/recommendations.js';
import { createThumbnail } from '@core/utils/image-thumbnail.js';
import { ROUTES } from '../paths.js';

const ParamsSchema = z.object({
  requestId: z.string().uuid(),
  imageId: z.string().regex(/^\d+$/).openapi({ type: 'integer' }),
});

const QuerySchema = z.object({
  thumbnail: z.enum(['true']).optional().openapi({
    description: 'Return a small resized preview instead of the full-resolution original',
  }),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.GET_PROFILE_IMAGE,
  tags: ['profile'],
  request: {
    params: ParamsSchema,
    query: QuerySchema,
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
  requestId: string,
  imageId: number,
  thumbnail: boolean
): Promise<GetImageResult> {
  const { db } = c.get('databaseClient');
  const image = await findImageByIdForRequest(db, imageId, requestId);

  if (!image) {
    return { status: 404, body: { error: 'Image not found' } };
  }

  if (thumbnail) {
    const resized = await createThumbnail(image.image);
    return { status: 200, body: resized.buffer, contentType: resized.contentType };
  }

  return { status: 200, body: image.image, contentType: image.contentType };
}

export function registerGetImageRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId, imageId } = c.req.valid('param');
    const { thumbnail } = c.req.valid('query');
    const result = await getImage(c, requestId, Number(imageId), thumbnail === 'true');

    if (result.status === 404) {
      return c.json(result.body, 404);
    }

    // An image's bytes never change for a given id (edits are delete-and-re-add), so the
    // browser can cache it indefinitely and skip re-fetching it on every profile page visit.
    return c.body(new Uint8Array(result.body), 200, {
      'Content-Type': result.contentType,
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
  });
}
