/**
 * AWS S3 client factory
 */
import { S3Client } from '@aws-sdk/client-s3';

export interface S3ClientWrapper {
  client: S3Client;
  close: () => Promise<void>;
}

/**
 * Create an S3 client wrapper with connection settings
 *
 * @param region - AWS region
 * @param endpoint - S3 endpoint URL (optional for local testing)
 * @param accessKeyId - AWS access key ID
 * @param secretAccessKey - AWS secret access key
 * @returns S3 client wrapper with close method
 */
export async function createS3ClientWrapper(
  region: string,
  endpoint: string | undefined,
  accessKeyId: string,
  secretAccessKey: string
): Promise<S3ClientWrapper> {
  const client = new S3Client({
    region,
    ...(endpoint && { endpoint }),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return {
    client,
    close: async () => {
      await client.destroy();
    },
  };
}
