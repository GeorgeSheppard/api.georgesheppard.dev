import { test as base } from 'vitest';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer
} from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { createDatabaseClient, DatabaseClient } from '@core/database/client.js';
import { createQueueClient, QueueClient } from '@core/queue/client.js';

/**
 * Extended test context with container fixtures.
 *
 * Usage examples:
 * - PostgreSQL only: test('...', async ({ dbClient }) => {})
 * - Both containers: test('...', async ({ dbClient, queueClient }) => {})
 * - No containers: use regular vitest imports
 */
export const test = base.extend<{
  postgresContainer: StartedPostgreSqlContainer;
  rabbitmqContainer: StartedRabbitMQContainer;
  dbClient: DatabaseClient;
  queueClient: QueueClient;
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
    { scope: 'worker', auto: false }
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
    { scope: 'worker', auto: false }
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
  }
});

// Re-export vitest utilities for convenience
export { expect, describe, beforeEach, afterEach } from 'vitest';
