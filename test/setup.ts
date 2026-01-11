import { config } from "@config/index";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { beforeAll, afterAll } from 'vitest';

let postgresContainer: StartedPostgreSqlContainer | null = null;
let rabbitmqContainer: StartedRabbitMQContainer | null = null;

/**
 * Start PostgreSQL and RabbitMQ containers for integration tests
 * Containers bind to ports specified in .env.test
 * All environment variables come from .env.test (loaded by vitest.config.ts)
 */
beforeAll(async () => {
  postgresContainer = (await new PostgreSqlContainer('postgres:16-alpine')
    .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
    .start());
  config.DATABASE_URL = postgresContainer.getConnectionUri()

  console.log('✅ PostgreSQL container started');

  rabbitmqContainer = (await new RabbitMQContainer('rabbitmq:4.0.5-management')
    .start());
  config.RABBITMQ_URL = rabbitmqContainer.getAmqpUrl()

  console.log('✅ RabbitMQ container started');
}, 120000);

/**
 * Stop containers after tests
 */
afterAll(async () => {
  if (postgresContainer) {
    await postgresContainer.stop();
  }
  if (rabbitmqContainer) {
    await rabbitmqContainer.stop();
  }
  console.log('✅ Containers stopped');
}, 60000);
