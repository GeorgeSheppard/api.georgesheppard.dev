import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { deleteS3Object } from '@core/s3/utilities.js';

export const S3DeleteRequestSchema = z.object({
  key: z.string().describe('S3 object key to delete'),
});

export type S3DeleteRequest = z.infer<typeof S3DeleteRequestSchema>;

export const S3DeleteResponseSchema = z.object({
  success: z.boolean().describe('Whether delete was successful'),
});

export type S3DeleteResponse = z.infer<typeof S3DeleteResponseSchema>;

export async function deleteFile(
  c: ContextWithUserId,
  key: string
): Promise<S3DeleteResponse> {
  const s3Client = c.get('s3Client');

  try {
    await deleteS3Object(s3Client.client, key);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to delete S3 object', error);
    throw error;
  }
}
