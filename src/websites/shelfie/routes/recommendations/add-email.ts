import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import {
  findRecommendationById,
  findRequestById,
  updateRequestEmailFields,
} from '../../queries/recommendations.js';
import { encryption } from '@core/utils/encryption.js';
import { ROUTES } from '../paths.js';

const BodySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  recurring: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

const SuccessResponse = z.object({
  success: z.literal(true),
});

const ErrorResponse = z.object({
  success: z.literal(false),
  error: z.string(),
});

const ResponseSchema = z.union([SuccessResponse, ErrorResponse]);

const route = createRoute({
  method: 'post',
  path: ROUTES.ADD_EMAIL,
  tags: ['recommendations'],
  request: {
    body: {
      content: {
        'application/x-www-form-urlencoded': {
          schema: BodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ResponseSchema } },
      description: 'Email added successfully',
    },
    400: {
      content: { 'application/json': { schema: ResponseSchema } },
      description: 'Bad request',
    },
    404: {
      content: { 'application/json': { schema: ResponseSchema } },
      description: 'Recommendation not found',
    },
  },
});

export type AddEmailSuccess = { success: true };
export type AddEmailError = { success: false; error: string };

export type AddEmailResult =
  | { status: 200; body: AddEmailSuccess }
  | { status: 400; body: AddEmailError }
  | { status: 404; body: AddEmailError };

export interface AddEmailInput {
  id: string;
  email?: string;
  recurring?: boolean;
}

export async function addEmail(c: Context, input: AddEmailInput): Promise<AddEmailResult> {
  const { db } = c.get('databaseClient');
  const emailClient = c.get('emailClient');

  const recommendation = await findRecommendationById(db, input.id);
  if (!recommendation) {
    return { status: 404, body: { error: 'Recommendation not found', success: false } };
  }

  const requestId = recommendation.requestId;
  const existingRequest = await findRequestById(db, requestId);

  let finalEmail = input.email;
  if (!finalEmail && existingRequest?.email) {
    finalEmail = encryption.decrypt(existingRequest.email);
  }

  if (!finalEmail) {
    return { status: 400, body: { error: 'No email provided', success: false } };
  }

  const encryptedEmail = encryption.encrypt(finalEmail);
  const isRecurring = input.recurring === true;
  const recommendationsAlreadyDone = !!(
    recommendation.processedUtc && recommendation.recommendations
  );

  const shouldStoreEmail = !recommendationsAlreadyDone || isRecurring;
  const emailToStore = shouldStoreEmail ? encryptedEmail : null;

  await updateRequestEmailFields(db, requestId, {
    email: emailToStore,
    frequency: isRecurring ? 'M' : null,
    nextRecommendationUtc: isRecurring ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
  });

  if (recommendationsAlreadyDone) {
    try {
      await emailClient.sendRecommendationsEmail({
        from: 'Shelfie <postmaster@mailgun.shelfie.georgesheppard.dev>',
        to: [finalEmail],
        subject: 'Your Shelfie recommendations are here!',
        template: 'recommendations',
        variables: {
          recommendationsurl: `https://shelfie.georgesheppard.dev/recommendations/${input.id}`,
          unsubscribeUrl: `https://shelfie.georgesheppard.dev/unsubscribe/${requestId}`,
          unsubscribeText: isRecurring ? 'Unsubscribe' : '',
        },
      });
    } catch (error) {
      console.error(`Failed to send email: ${error}`);
    }
  }

  return { status: 200, body: { success: true } };
}

export function registerAddEmailRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { id, email, recurring } = c.req.valid('form');
    const result = await addEmail(c, { id, email, recurring });

    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 400:
        return c.json(result.body, 400);
      case 404:
        return c.json(result.body, 404);
    }
  });
}
