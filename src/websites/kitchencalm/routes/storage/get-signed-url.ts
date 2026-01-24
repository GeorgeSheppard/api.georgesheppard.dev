import { OpenAPIHono } from '@hono/zod-openapi';
import { getSignedDownloadUrl } from '../../utils/s3.js';
import { ROUTES } from '../paths.js';

export function registerGetSignedUrlRoute(app: OpenAPIHono) {
  app.get(ROUTES.GET_SIGNED_URL, async (c) => {
    const key = c.req.param('key') as string;
    const s3Client = c.get('s3Client');

    try {
      // Decode URL-encoded key
      const decodedKey = decodeURIComponent(key);

      const signedUrl = await getSignedDownloadUrl(s3Client, decodedKey);

      return c.json({ url: signedUrl }, 200);
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return c.json({ error: 'Failed to generate signed URL' }, 500);
    }
  });
}
