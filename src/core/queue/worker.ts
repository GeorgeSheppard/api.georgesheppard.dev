import '@core/telemetry/init.js';
import amqp from 'amqplib';
import { createQueueClient } from './client.js';
import { createDatabaseClient } from '@core/database/client.js';
import { processRecommendationJob } from '@websites/shelfie/workers/recommendation-worker.js';
import { config } from '@config/index.js';
import { MailgunClient } from '@core/utils/mailgun.js';
import { OpenAIRecommender } from '@core/utils/openai-recommender.js';
import { processSiloJob } from '@websites/silo/generation/process-job.js';
import { MavenBuilder } from '@websites/silo/generation/builder.js';
import { createAnthropicModelClient } from '@websites/silo/generation/anthropic-model-client.js';
import { createS3ClientWrapper } from '@core/s3/client.js';
import { logger } from '@core/telemetry/logger.js';

const MAX_RETRIES = 2;

function requeueOrDrop(
  channel: amqp.Channel,
  queue: string,
  msg: amqp.ConsumeMessage,
  label: string
) {
  const retryCount = (msg.properties.headers?.['x-retry-count'] as number) ?? 0;
  if (retryCount < MAX_RETRIES) {
    channel.sendToQueue(queue, msg.content, {
      persistent: true,
      headers: { 'x-retry-count': retryCount + 1 },
    });
  } else {
    logger.error(`${label} exceeded max retries, dropping message`);
  }
}

async function main() {
  logger.info('Starting RabbitMQ workers...');

  const queueClient = await createQueueClient(config.RABBITMQ_URL);
  const databaseClient = await createDatabaseClient(config.DATABASE_URL);
  const emailClient = new MailgunClient();
  const recommender = new OpenAIRecommender();
  const { channel, recommendationQueue, siloQueue } = queueClient;
  const s3Client = await createS3ClientWrapper(
    config.S3_REGION,
    config.S3_ENDPOINT,
    config.S3_ACCESS_KEY_ID,
    config.S3_SECRET_ACCESS_KEY
  );
  const modelClient = createAnthropicModelClient(config.ANTHROPIC_API_KEY);
  const builder = new MavenBuilder();

  // Set prefetch to 1 to ensure fair distribution
  await channel.prefetch(1);

  // Set up recommendation consumer
  await channel.consume(recommendationQueue, async (msg) => {
    if (!msg) return;
    channel.ack(msg);

    try {
      const job = JSON.parse(msg.content.toString());
      logger.info(`Processing recommendation job:`, job);
      await processRecommendationJob(job, databaseClient, emailClient, recommender);
      logger.info(`Recommendation job completed`);
    } catch (err) {
      logger.error(`Recommendation job failed:`, err);
      requeueOrDrop(channel, recommendationQueue, msg, 'Recommendation job');
    }
  });

  // Jobs are costly and not idempotent: ack immediately and mark the job failed instead of retrying
  await channel.consume(siloQueue, async (msg) => {
    if (!msg) return;
    channel.ack(msg);
    try {
      const { jobId } = JSON.parse(msg.content.toString()) as { jobId: string };
      await processSiloJob(jobId, {
        databaseClient,
        s3Client: s3Client.client,
        modelClient,
        builder,
        model: config.SILO_MODEL,
      });
    } catch (err) {
      logger.error('Silo job failed:', err);
    }
  });

  logger.info('Recommendation worker started');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down workers...`);

    try {
      await Promise.all([queueClient.close(), databaseClient.close(), s3Client.close()]);
      logger.info('Workers closed');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Worker startup failed:', err);
  process.exit(1);
});
