import { S3ClientWrapper } from '@core/storage/s3-client.js';

export function createMockS3Client(): S3ClientWrapper {
  return {
    client: {} as any,
    bucketName: 'test-bucket',
    getSignedUrl: async () => 'https://example.com/signed-url',
    getSignedPutUrl: async () => 'https://example.com/signed-put-url',
    deleteObject: async () => {},
    close: async () => {},
  };
}
