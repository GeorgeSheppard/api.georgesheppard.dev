import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { recommendations, requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { encryption } from '@core/utils/encryption.js';
import { ROUTES } from '../paths.js';

const BodySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  recurring: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  test: z.boolean().optional(),
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

export function registerAddEmailRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { id, email, recurring } = c.req.valid('form');

    const { db } = c.get('databaseClient');
    const emailClient = c.get('emailClient');

    // Find the recommendation by ID
    const recommendation = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, id))
      .limit(1);

    if (recommendation.length === 0) {
      return c.json({ error: 'Recommendation not found', success: false }, 404);
    }

    const requestId = recommendation[0].requestId;

    // Look up the original request to get email if not provided
    const [existingRequest] = await db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);

    // Determine final email - use provided email or decrypt from request
    let finalEmail = email;
    if (!finalEmail && existingRequest?.email) {
      finalEmail = encryption.decrypt(existingRequest.email);
    }

    if (!finalEmail) {
      return c.json({ error: 'No email provided', success: false }, 400);
    }

    const encryptedEmail = encryption.encrypt(finalEmail);
    const isRecurring = recurring === true;
    const recommendationsAlreadyDone = !!(
      recommendation[0].processedUtc && recommendation[0].recommendations
    );

    // Only store email if recommendations are NOT yet done OR user wants recurring
    const shouldStoreEmail = !recommendationsAlreadyDone || isRecurring;
    const emailToStore = shouldStoreEmail ? encryptedEmail : null;

    // Update the request with email and recurring settings
    await db
      .update(requests)
      .set({
        email: emailToStore,
        frequency: isRecurring ? 'M' : null,
        nextRecommendationUtc: isRecurring ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      })
      .where(eq(requests.id, requestId));

    // If recommendations are already done, send email immediately
    if (recommendationsAlreadyDone) {
      try {
        await emailClient.sendRecommendationsEmail({
          from: 'Shelfie <postmaster@mailgun.shelfie.georgesheppard.dev>',
          to: [finalEmail],
          subject: 'Your Shelfie recommendations are here!',
          template: 'recommendations',
          variables: {
            recommendationsurl: `https://shelfie.georgesheppard.dev/recommendations/${id}`,
            unsubscribeUrl: `https://shelfie.georgesheppard.dev/unsubscribe/${requestId}`,
            unsubscribeText: isRecurring ? 'Unsubscribe' : '',
          },
        });
      } catch (error) {
        console.error(`Failed to send email: ${error}`);
      }
    }

    return c.json({ success: true });
  });
}
