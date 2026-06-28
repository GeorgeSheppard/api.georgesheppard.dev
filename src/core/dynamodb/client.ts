/**
 * DynamoDB client factory for Mise backend
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

export interface DynamoDBClientWrapper {
  client: DynamoDBDocument;
  close: () => Promise<void>;
}

/**
 * Create a DynamoDB client wrapper with connection settings
 *
 * @param region - AWS region
 * @param endpoint - DynamoDB endpoint URL (optional for local testing)
 * @param accessKeyId - AWS access key ID
 * @param secretAccessKey - AWS secret access key
 * @returns DynamoDB client wrapper with close method
 */
export async function createDynamoDBClient(
  region: string,
  endpoint: string | undefined,
  accessKeyId: string,
  secretAccessKey: string
): Promise<DynamoDBClientWrapper> {
  const baseClient = new DynamoDBClient({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const docClient = DynamoDBDocument.from(baseClient, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  return {
    client: docClient,
    close: async () => {
      await baseClient.destroy();
    },
  };
}
