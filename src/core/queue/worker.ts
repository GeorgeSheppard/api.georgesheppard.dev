import '@core/telemetry/init.js';
import amqp from 'amqplib';
import { createQueueClient, type EngineJob } from './client.js';
import { createDatabaseClient } from '@core/database/client.js';
import { processRecommendationJob } from '@websites/shelfie/workers/recommendation-worker.js';
import { config } from '@config/index.js';
import { MailgunClient } from '@core/utils/mailgun.js';
import { OpenAIRecommender } from '@core/utils/openai-recommender.js';
import { processEngineJob } from '@websites/engine/generation/process-job.js';
import { MavenBuilder } from '@websites/engine/generation/builder.js';
import { createAnthropicModelClient } from '@websites/engine/generation/anthropic-model-client.js';
import { createS3ClientWrapper } from '@core/s3/client.js';
import { createHostingProvider, createSweepDeps } from '@websites/engine/hosting/provider.js';
import { sweepServers } from '@websites/engine/hosting/sweeper.js';
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
  const { channel, recommendationQueue, engineQueue } = queueClient;
  const s3Client = await createS3ClientWrapper(
    config.S3_REGION,
    config.S3_ENDPOINT,
    config.S3_ACCESS_KEY_ID,
    config.S3_SECRET_ACCESS_KEY
  );
  const modelClient = createAnthropicModelClient(config.ANTHROPIC_API_KEY);
  const builder = new MavenBuilder();
  const hostingProvider = createHostingProvider();

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
  await channel.consume(engineQueue, async (msg) => {
    if (!msg) return;
    channel.ack(msg);
    try {
      const job = JSON.parse(msg.content.toString()) as EngineJob;
      await processEngineJob(job, {
        databaseClient,
        s3Client: s3Client.client,
        modelClient,
        builder,
        model: config.ENGINE_MODEL,
        hosting: { provider: hostingProvider, maxServers: config.ENGINE_MAX_SERVERS },
      });
    } catch (err) {
      logger.error('Engine job failed:', err);
    }
  });

  // Hetzner bills idle servers: delete servers with no players or past their max age
  const sweepDeps = createSweepDeps(databaseClient);
  let sweeping = false;
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await sweepServers(sweepDeps);
    } catch (err) {
      logger.error('Engine sweep failed:', err);
    } finally {
      sweeping = false;
    }
  };
  const sweepTimer = setInterval(sweep, 60_000);
  void sweep();

  logger.info('Recommendation worker started');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down workers...`);
    clearInterval(sweepTimer);

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
