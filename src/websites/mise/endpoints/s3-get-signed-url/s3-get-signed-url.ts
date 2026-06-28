import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getSignedGetUrl } from '@core/s3/utilities.js';

export const S3GetSignedUrlRequestSchema = z.object({
  key: z.string().describe('S3 object key'),
});

export type S3GetSignedUrlRequest = z.infer<typeof S3GetSignedUrlRequestSchema>;

export const S3GetSignedUrlResponseSchema = z.object({
  signedUrl: z.string().url().describe('Signed GET URL valid for download'),
});

export type S3GetSignedUrlResponse = z.infer<typeof S3GetSignedUrlResponseSchema>;

export async function getSignedUrl(
  c: ContextWithUserId,
  key: string
): Promise<S3GetSignedUrlResponse> {
  const s3Client = c.get('s3Client');

  try {
    const signedUrl = await getSignedGetUrl(s3Client.client, key);

    return {
      signedUrl,
    };
  } catch (error) {
    console.error('Failed to generate signed GET URL', error);
    throw error;
  }
}
