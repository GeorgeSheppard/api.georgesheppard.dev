import { serve } from '@hono/node-server';
import { createApp } from './server.js';
import { config } from '@config/index.js';
import { createQueueClient } from '@core/queue/client.js';
import { createDatabaseClient } from '@core/database/client.js';
import { createDynamoDBClient } from '@core/dynamodb/client.js';
import { MailgunClient } from '@core/utils/mailgun.js';
import { CountryIsIpLocator } from '@core/utils/ip-locator.js';

async function main() {
  const databaseClient = await createDatabaseClient(config.DATABASE_URL);
  const queueClient = await createQueueClient(config.RABBITMQ_URL);
  const dynamoClient = await createDynamoDBClient(
    config.DYNAMODB_REGION,
    config.DYNAMODB_ENDPOINT,
    config.DYNAMODB_ACCESS_KEY_ID,
    config.DYNAMODB_SECRET_ACCESS_KEY
  );
  const emailClient = new MailgunClient();
  const ipLocator = new CountryIsIpLocator();
  const app = await createApp({
    databaseClient,
    queueClient,
    dynamoClient,
    emailClient,
    ipLocator,
  });

  const server = serve({
    fetch: app.fetch,
    port: config.PORT,
    hostname: '0.0.0.0',
  });

  console.log(`🚀 Server is running on http://localhost:${config.PORT}`);
  console.log(`📚 Swagger UI available at http://localhost:${config.PORT}/swagger`);

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    try {
      await Promise.all([databaseClient.close(), queueClient.close(), dynamoClient.close()]);
      server.close();
      console.log('✅ Server closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
