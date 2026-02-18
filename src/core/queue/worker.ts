import '@core/telemetry/init.js';
import { createQueueClient } from './client.js';
import { createDatabaseClient } from '@core/database/client.js';
import { processTextExtractionJob } from '@websites/shelfie/workers/text-extraction-worker.js';
import { processRecommendationJob } from '@websites/shelfie/workers/recommendation-worker.js';
import { config } from '@config/index.js';
import { MailgunClient } from '@core/utils/mailgun.js';
import { OpenAIRecommender } from '@core/utils/openai-recommender.js';
import { logger } from '@core/telemetry/logger.js';

async function main() {
  logger.info('Starting RabbitMQ workers...');

  const queueClient = await createQueueClient(config.RABBITMQ_URL);
  const databaseClient = await createDatabaseClient(config.DATABASE_URL);
  const emailClient = new MailgunClient();
  const recommender = new OpenAIRecommender();
  const { channel, textExtractionQueue, recommendationQueue } = queueClient;

  // Set prefetch to 1 to ensure fair distribution
  await channel.prefetch(1);

  // Set up text extraction consumer
  await channel.consume(textExtractionQueue, async (msg) => {
    if (!msg) return;

    try {
      const job = JSON.parse(msg.content.toString());
      logger.info(`Processing text extraction job:`, job);
      await processTextExtractionJob(job, databaseClient, queueClient);
      channel.ack(msg);
      logger.info(`Text extraction job completed`);
    } catch (err) {
      logger.error(`Text extraction job failed:`, err);
      channel.nack(msg, false, true); // Requeue on error
    }
  });

  // Set up recommendation consumer
  await channel.consume(recommendationQueue, async (msg) => {
    if (!msg) return;

    try {
      const job = JSON.parse(msg.content.toString());
      logger.info(`Processing recommendation job:`, job);
      await processRecommendationJob(job, databaseClient, emailClient, recommender);
      channel.ack(msg);
      logger.info(`Recommendation job completed`);
    } catch (err) {
      logger.error(`Recommendation job failed:`, err);
      channel.nack(msg, false, true); // Requeue on error
    }
  });

  logger.info('Text extraction worker started');
  logger.info('Recommendation worker started');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down workers...`);

    try {
      await Promise.all([queueClient.close(), databaseClient.close()]);
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
