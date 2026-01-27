import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { config } from '@config/index.js';

export const awsDynamoClient = new DynamoDBClient({
  region: config.AWS_DYNAMO_REGION,
  credentials: {
    accessKeyId: config.AWS_DYNAMO_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_DYNAMO_SECRET_ACCESS_KEY,
  },
});

export const awsDynamoDocClient = DynamoDBDocument.from(awsDynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
