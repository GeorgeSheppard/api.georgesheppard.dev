import { OpenAPIHono } from '@hono/zod-openapi';
import { deleteS3Object } from '../../utils/s3.js';
import { ROUTES } from '../paths.js';

export function registerDeleteStorageRoute(app: OpenAPIHono) {
  app.delete(ROUTES.DELETE_STORAGE, async (c) => {
    const key = c.req.param('key') as string;
    const s3Client = c.get('s3Client');

    try {
      const decodedKey = decodeURIComponent(key);
      await deleteS3Object(s3Client, decodedKey);

      return c.json({ success: true }, 200);
    } catch (error) {
      console.error('Error deleting storage object:', error);
      return c.json({ error: 'Failed to delete object' }, 500);
    }
  });
}
