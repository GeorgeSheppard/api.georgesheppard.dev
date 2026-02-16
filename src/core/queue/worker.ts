import { createQueueClient } from './client.js';
import { createDatabaseClient } from '@core/database/client.js';
import { processTextExtractionJob } from '@websites/shelfie/workers/text-extraction-worker.js';
import { processRecommendationJob } from '@websites/shelfie/workers/recommendation-worker.js';
import { initializeConfig, config } from '@config/index.js';
import { MailgunClient } from '@core/utils/mailgun.js';
import { OpenAIRecommender } from '@core/utils/openai-recommender.js';

async function main() {
  console.log('🔧 Starting RabbitMQ workers...');

  await initializeConfig();

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
      console.log(`📦 Processing text extraction job:`, job);
      await processTextExtractionJob(job, databaseClient, queueClient);
      channel.ack(msg);
      console.log(`✓ Text extraction job completed`);
    } catch (err) {
      console.error(`✗ Text extraction job failed:`, err);
      channel.nack(msg, false, true); // Requeue on error
    }
  });

  // Set up recommendation consumer
  await channel.consume(recommendationQueue, async (msg) => {
    if (!msg) return;

    try {
      const job = JSON.parse(msg.content.toString());
      console.log(`📦 Processing recommendation job:`, job);
      await processRecommendationJob(job, databaseClient, emailClient, recommender);
      channel.ack(msg);
      console.log(`✓ Recommendation job completed`);
    } catch (err) {
      console.error(`✗ Recommendation job failed:`, err);
      channel.nack(msg, false, true); // Requeue on error
    }
  });

  console.log('✅ Text extraction worker started');
  console.log('✅ Recommendation worker started');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down workers...`);

    try {
      await Promise.all([queueClient.close(), databaseClient.close()]);
      console.log('✅ Workers closed');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('❌ Worker startup failed:', err);
  process.exit(1);
});
