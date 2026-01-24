import {
  S3Client,
  S3ClientConfig,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const SIGNED_URL_EXPIRATION = 3600; // 1 hour

export interface S3ClientWrapper {
  client: S3Client;
  bucketName: string;
  getSignedUrl: (key: string) => Promise<string>;
  getSignedPutUrl: (key: string) => Promise<string>;
  deleteObject: (key: string) => Promise<void>;
  close: () => Promise<void>;
}

export async function createS3Client(
  region: string,
  bucketName: string,
  accessKeyId?: string,
  secretAccessKey?: string
): Promise<S3ClientWrapper> {
  const clientConfig: S3ClientConfig = {
    region,
  };

  // Add credentials if provided (for local/testing)
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }

  // Support LocalStack for testing
  if (process.env.AWS_S3_ENDPOINT) {
    clientConfig.endpoint = process.env.AWS_S3_ENDPOINT;
    clientConfig.forcePathStyle = true; // Required for LocalStack
  }

  const s3Client = new S3Client(clientConfig);

  return {
    client: s3Client,
    bucketName,
    getSignedUrl: async (key: string): Promise<string> => {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, {
        expiresIn: SIGNED_URL_EXPIRATION,
      });

      return url;
    },
    getSignedPutUrl: async (key: string): Promise<string> => {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, {
        expiresIn: SIGNED_URL_EXPIRATION,
      });

      return url;
    },
    deleteObject: async (key: string): Promise<void> => {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await s3Client.send(command);
    },
    close: async () => {
      s3Client.destroy();
    },
  };
}

// Export command types for use in handlers
export { DeleteObjectCommand, GetObjectCommand, PutObjectCommand };
