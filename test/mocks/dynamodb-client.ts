import { DynamoDBClientWrapper } from '@core/database/dynamodb-client.js';

export function createMockDynamoDBClient(): DynamoDBClientWrapper {
  return {
    client: {} as any,
    tableName: 'test-table',
    close: async () => {},
  };
}
