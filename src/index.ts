import { serve } from '@hono/node-server';
import { createApp } from './server.js';
import { config } from '@config/index.js';
import { createQueueClient } from "@core/queue/client.js";
import { createDatabaseClient } from "@core/database/client.js";
import { createDynamoDBClient } from "@core/database/dynamodb-client.js";
import { createS3Client } from "@core/storage/s3-client.js";
import { MailgunClient } from "@core/utils/mailgun.js";
import { CountryIsIpLocator } from "@core/utils/ip-locator.js";

async function main() {
  const databaseClient = await createDatabaseClient(config.DATABASE_URL)
  const queueClient = await createQueueClient(config.RABBITMQ_URL)
  const dynamoDBClient = await createDynamoDBClient(
    config.AWS_REGION,
    config.DYNAMODB_TABLE_NAME,
    config.AWS_ACCESS_KEY_ID,
    config.AWS_SECRET_ACCESS_KEY
  )
  const s3Client = await createS3Client(
    config.AWS_REGION,
    config.S3_BUCKET_NAME,
    config.AWS_ACCESS_KEY_ID,
    config.AWS_SECRET_ACCESS_KEY
  )
  const emailClient = new MailgunClient()
  const ipLocator = new CountryIsIpLocator()
  const app = await createApp(databaseClient, queueClient, emailClient, ipLocator, dynamoDBClient, s3Client);

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
      await Promise.all([databaseClient.close(), queueClient.close(), dynamoDBClient.close(), s3Client.close()]);
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
