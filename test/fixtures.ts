import { test as base } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { LocalstackContainer, StartedLocalStackContainer } from '@testcontainers/localstack';
import { createDatabaseClient, DatabaseClient } from '@core/database/client.js';
import { createQueueClient, QueueClient } from '@core/queue/client.js';
import { createDynamoDBClient, DynamoDBClientWrapper } from '@core/dynamodb/client.js';
import { CreateTableCommand, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { config } from '@config/index.js';

/**
 * Extended test context with container fixtures.
 *
 * Usage examples:
 * - PostgreSQL only: test('...', async ({ dbClient }) => {})
 * - Both containers: test('...', async ({ dbClient, queueClient }) => {})
 * - With DynamoDB: test('...', async ({ dynamoClient }) => {})
 * - No containers: use regular vitest imports
 */
export const test = base.extend<{
  postgresContainer: StartedPostgreSqlContainer;
  rabbitmqContainer: StartedRabbitMQContainer;
  dynamodbContainer: StartedLocalStackContainer;
  dbClient: DatabaseClient;
  queueClient: QueueClient;
  dynamoClient: DynamoDBClientWrapper;
}>({
  // Worker-scoped PostgreSQL container (started once per worker)
  postgresContainer: [
    async ({}, use) => {
      console.log('🐘 Starting PostgreSQL container...');
      const container = await new PostgreSqlContainer('postgres:16-alpine')
        .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
        .start();
      console.log('✅ PostgreSQL container started');

      await use(container);

      console.log('🛑 Stopping PostgreSQL container');
      await container.stop();
    },
    { scope: 'worker', auto: false },
  ],

  // Worker-scoped RabbitMQ container (started once per worker)
  rabbitmqContainer: [
    async ({}, use) => {
      console.log('🐰 Starting RabbitMQ container...');
      const container = await new RabbitMQContainer('rabbitmq:4.0.5-management').start();
      console.log('✅ RabbitMQ container started');

      await use(container);

      console.log('🛑 Stopping RabbitMQ container');
      await container.stop();
    },
    { scope: 'worker', auto: false },
  ],

  // Worker-scoped DynamoDB container (started once per worker)
  dynamodbContainer: [
    async ({}, use) => {
      console.log('🗄️ Starting DynamoDB container...');
      const container = await new LocalstackContainer('localstack/localstack:latest')
        .withEnvironment({
          SERVICES: 'dynamodb',
          DEBUG: '1',
        })
        .start();
      console.log('✅ DynamoDB container started');

      await use(container);

      console.log('🛑 Stopping DynamoDB container');
      await container.stop();
    },
    { scope: 'worker', auto: false },
  ],

  // Test-scoped database client (fresh per test)
  dbClient: async ({ postgresContainer }, use) => {
    const client = await createDatabaseClient(postgresContainer.getConnectionUri());
    await use(client);
    await client.close();
  },

  // Test-scoped queue client (fresh per test)
  queueClient: async ({ rabbitmqContainer }, use) => {
    const client = await createQueueClient(rabbitmqContainer.getAmqpUrl());
    await use(client);
    await client.close();
  },

  // Test-scoped DynamoDB client (fresh per test)
  dynamoClient: async ({ dynamodbContainer }, use) => {
    const client = await createDynamoDBClient(
      config.DYNAMODB_REGION,
      dynamodbContainer.getConnectionUri(),
      config.DYNAMODB_ACCESS_KEY_ID,
      config.DYNAMODB_SECRET_ACCESS_KEY
    );

    // Create test table with proper schema
    try {
      await client.client.send(
        new CreateTableCommand({
          TableName: config.DYNAMODB_TABLE_NAME,
          KeySchema: [
            { AttributeName: 'UserId', KeyType: 'HASH' },
            { AttributeName: 'Item', KeyType: 'RANGE' },
          ],
          AttributeDefinitions: [
            { AttributeName: 'UserId', AttributeType: 'S' },
            { AttributeName: 'Item', AttributeType: 'S' },
          ],
          BillingMode: 'PAY_PER_REQUEST',
        })
      );
    } catch (error) {
      if (!(error instanceof ResourceInUseException)) {
        throw error;
      }
    }

    await use(client);
    await client.close();
  },
});

// Re-export vitest utilities for convenience
export { expect, describe, beforeEach, afterEach } from 'vitest';
