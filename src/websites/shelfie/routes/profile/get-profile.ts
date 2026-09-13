import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { findProfileByRequestId } from '../../queries/recommendations.js';
import { ROUTES } from '../paths.js';
import type { BookEntry } from '@core/types/recommendation.js';

const ParamsSchema = z.object({
  requestId: z.string().uuid(),
});

const BookEntrySchema = z.object({
  title: z.string(),
  author: z.string().nullable(),
});

const ImageSchema = z.object({
  id: z.number(),
  contentType: z.string(),
  // Separate from requestId on purpose: this is the capability the frontend uses to build
  // the viewing URL, so leaking one photo's URL never exposes the rest of the profile.
  accessToken: z.string().uuid(),
  extractedBooks: z.array(BookEntrySchema).nullable(),
  processedUtc: z.string().datetime().nullable(),
});

const SuccessSchema = z.object({
  images: z.array(ImageSchema),
  customPreferences: z.string().nullable(),
  success: z.literal(true),
});

const ErrorSchema = z.object({
  error: z.string(),
  success: z.literal(false),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.GET_PROFILE,
  tags: ['profile'],
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessSchema } },
      description: 'Profile retrieved successfully',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Request not found',
    },
  },
});

export type GetProfileSuccess = {
  images: {
    id: number;
    contentType: string;
    accessToken: string;
    extractedBooks: BookEntry[] | null;
    processedUtc: string | null;
  }[];
  customPreferences: string | null;
  success: true;
};

export type GetProfileError = { error: string; success: false };

export type GetProfileResult =
  | { status: 200; body: GetProfileSuccess }
  | { status: 404; body: GetProfileError };

export async function getProfile(c: Context, requestId: string): Promise<GetProfileResult> {
  const { db } = c.get('databaseClient');
  const profile = await findProfileByRequestId(db, requestId);

  if (!profile) {
    return { status: 404, body: { error: 'Request not found', success: false } };
  }

  return {
    status: 200,
    body: {
      images: profile.images.map((image) => ({
        id: image.id,
        contentType: image.contentType,
        accessToken: image.accessToken,
        extractedBooks: image.extractedBooks,
        processedUtc: image.processedUtc?.toISOString() ?? null,
      })),
      customPreferences: profile.customPreferences,
      success: true,
    },
  };
}

export function registerGetProfileRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId } = c.req.valid('param');
    const result = await getProfile(c, requestId);

    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 404:
        return c.json(result.body, 404);
    }
  });
}
