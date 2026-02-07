import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getSignedPutUrl } from '@core/s3/utilities.js';

export const S3PutSignedUrlRequestSchema = z.object({
  fileName: z.string().describe('Original filename'),
  contentType: z.string().describe('MIME type (e.g., "image/jpeg")'),
});

export type S3PutSignedUrlRequest = z.infer<typeof S3PutSignedUrlRequestSchema>;

export const S3PutSignedUrlResponseSchema = z.object({
  signedUrl: z.string().url().describe('Signed PUT URL valid for upload'),
  key: z.string().describe('S3 object key where file will be stored'),
});

export type S3PutSignedUrlResponse = z.infer<typeof S3PutSignedUrlResponseSchema>;

export async function putSignedUrl(
  c: ContextWithUserId,
  fileName: string,
  contentType: string
): Promise<S3PutSignedUrlResponse> {
  const userId = c.get('userId');
  const s3Client = c.get('s3Client');

  try {
    const signedUrl = await getSignedPutUrl(s3Client.client, userId, fileName, contentType);
    const key = `${userId}/${fileName}`;

    return {
      signedUrl,
      key,
    };
  } catch (error) {
    console.error('Failed to generate signed PUT URL', error);
    throw error;
  }
}
