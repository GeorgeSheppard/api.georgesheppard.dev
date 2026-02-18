/**
 * S3 utility functions for file operations
 */
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@config/index.js';
import { logger } from '@core/telemetry/logger.js';

/**
 * Generate a signed GET URL for downloading a file from S3
 *
 * @param client - S3 client
 * @param key - S3 object key
 * @returns Signed GET URL valid for download
 */
export async function getSignedGetUrl(client: S3Client, key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    logger.error('Failed to generate signed GET URL for S3:', error);
    throw error;
  }
}

/**
 * Generate a signed PUT URL for uploading a file to S3
 *
 * User's file will be stored at: {userId}/{fileName}
 *
 * @param client - S3 client
 * @param userId - User ID (for scoping uploads)
 * @param fileName - Original filename
 * @param contentType - MIME type (e.g., "image/jpeg")
 * @returns Signed PUT URL valid for upload
 */
export async function getSignedPutUrl(
  client: S3Client,
  userId: string,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    // Construct S3 key: {userId}/{fileName}
    const key = `${userId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    logger.error('Failed to generate signed PUT URL for S3:', error);
    throw error;
  }
}

/**
 * Delete an object from S3
 *
 * @param client - S3 client
 * @param key - S3 object key to delete
 * @returns Promise<void>
 */
export async function deleteS3Object(client: S3Client, key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    logger.error('Failed to delete S3 object:', error);
    throw error;
  }
}
