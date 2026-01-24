import { z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cognitoAuthMiddleware } from '@core/middleware/cognito-auth.js';
import { buildS3Key, getSignedUploadUrl } from '../../utils/s3.js';
import { ROUTES } from '../paths.js';
import { CognitoUser } from '@core/middleware/cognito-auth.js';

export function registerGetSignedPutUrlRoute(app: OpenAPIHono) {
  app.post(ROUTES.GET_SIGNED_PUT_URL, cognitoAuthMiddleware, async (c) => {
    const user = c.get('cognitoUser') as CognitoUser;
    const s3Client = c.get('s3Client');

    try {
      const body = await c.req.json();
      const { filename, folder } = body;

      if (!filename) {
        return c.json({ error: 'filename is required' }, 400);
      }

      const path = await buildS3Key(user.userId, filename, folder);
      const signedUrl = await getSignedUploadUrl(s3Client, path);

      return c.json({ signedUrl, path }, 200);
    } catch (error) {
      console.error('Error generating signed PUT URL:', error);
      return c.json({ error: 'Failed to generate signed PUT URL' }, 500);
    }
  });
}
