import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { addImagesToRequest } from '../../queries/recommendations.js';
import { extractAndStoreBooksPerImage } from '../../utils/image-extraction.js';
import { parseMultipartFiles } from '@core/utils/multipart.js';
import type { UploadedFile } from '@core/utils/multipart.js';
import { ROUTES } from '../paths.js';

const ParamsSchema = z.object({
  requestId: z.string().uuid(),
});

const SuccessSchema = z.object({
  imagesAdded: z.number(),
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
      description: 'Images added successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'No files uploaded',
    },
  },
});

export type AddImagesResult =
  | { status: 200; body: { imagesAdded: number; success: true } }
  | { status: 400; body: { error: string; success: false } };

export async function addImages(
  c: Context,
  requestId: string,
  files: UploadedFile[]
): Promise<AddImagesResult> {
  if (files.length === 0) {
    return { status: 400, body: { error: 'No files uploaded', success: false } };
  }

  const { db } = c.get('databaseClient');
  const imageIds = await addImagesToRequest(db, requestId, files);

  const openaiClient = c.get('openaiClient');
  // Only the newly added images need extraction — existing images already have their
  // own extractedBooks stored, so this doesn't re-process the whole request each time.
  await extractAndStoreBooksPerImage(db, files, imageIds, openaiClient);

  return { status: 200, body: { imagesAdded: files.length, success: true } };
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
    }
  });
}
