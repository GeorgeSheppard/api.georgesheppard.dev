import { S3ClientWrapper } from '@core/storage/s3-client.js';
import { S3Key, S3SignedUrl } from '../types/index.js';

/**
 * Build an S3 key from userId, optional folder, and filename
 */
export async function buildS3Key(
  userId: string,
  filename: string,
  folder?: string
): Promise<S3Key> {
  let key = userId;
  if (folder) {
    key += `/${folder}`;
  }
  key += `/${filename}`;
  return key;
}

/**
 * Get a presigned URL for downloading from S3
 */
export async function getSignedDownloadUrl(
  client: S3ClientWrapper,
  key: S3Key
): Promise<S3SignedUrl> {
  return await client.getSignedUrl(key);
}

/**
 * Get a presigned URL for uploading to S3
 */
export async function getSignedUploadUrl(
  client: S3ClientWrapper,
  key: S3Key
): Promise<S3SignedUrl> {
  return await client.getSignedPutUrl(key);
}

/**
 * Delete an object from S3
 */
export async function deleteS3Object(
  client: S3ClientWrapper,
  key: S3Key
): Promise<void> {
  await client.deleteObject(key);
}
