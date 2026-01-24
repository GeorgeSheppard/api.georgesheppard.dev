import {
  DynamoDBClient,
  DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

export interface DynamoDBClientWrapper {
  client: DynamoDBDocumentClient;
  tableName: string;
  close: () => Promise<void>;
}

export async function createDynamoDBClient(
  region: string,
  tableName: string,
  accessKeyId?: string,
  secretAccessKey?: string
): Promise<DynamoDBClientWrapper> {
  const clientConfig: DynamoDBClientConfig = {
    region,
  };

  // Add credentials if provided (for local/testing)
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }

  // Support local DynamoDB for testing
  if (process.env.AWS_DYNAMODB_ENDPOINT) {
    clientConfig.endpoint = process.env.AWS_DYNAMODB_ENDPOINT;
  }

  const dynamoDBClient = new DynamoDBClient(clientConfig);

  const documentClient = DynamoDBDocumentClient.from(dynamoDBClient, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  return {
    client: documentClient,
    tableName,
    close: async () => {
      dynamoDBClient.destroy();
    },
  };
}

// Export command types for use in handlers
export { QueryCommand, GetCommand, PutCommand, DeleteCommand, ScanCommand };
