import amqp from 'amqplib';
import { metrics, ObservableResult } from '@opentelemetry/api';
import { logger } from '@core/telemetry/logger.js';

const meter = metrics.getMeter('queue-client');
const queueDepthGauge = meter.createObservableGauge('rabbitmq.queue.messages', {
  description: 'Number of messages waiting in a RabbitMQ queue',
});

export interface RecommendationJob {
  userId: string;
  recommendationId: string;
}

export interface SiloJob {
  jobId: string;
}

export interface QueueClient {
  channel: amqp.Channel;
  connection: amqp.ChannelModel;
  recommendationQueue: string;
  siloQueue: string;
  close(): Promise<void>;
}

/**
 * Queue a recommendation generation job. Throws if the channel rejects the message, so
 * callers can decide how to surface that (e.g. a 500 response).
 */
export function enqueueRecommendationJob(queueClient: QueueClient, job: RecommendationJob): void {
  queueClient.channel.sendToQueue(
    queueClient.recommendationQueue,
    Buffer.from(JSON.stringify(job)),
    {
      persistent: true,
    }
  );
}

export function enqueueSiloJob(queueClient: QueueClient, job: SiloJob): void {
  queueClient.channel.sendToQueue(queueClient.siloQueue, Buffer.from(JSON.stringify(job)), {
    persistent: true,
  });
}

export async function createQueueClient(url: string): Promise<QueueClient> {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  // Declare queues
  const recommendationQueue = 'recommendations';

  const siloQueue = 'silo-jobs';

  await channel.assertQueue(recommendationQueue, { durable: true });
  await channel.assertQueue(siloQueue, { durable: true });

  const callback = async (observableResult: ObservableResult) => {
    for (const queue of [recommendationQueue, siloQueue]) {
      try {
        const { messageCount } = await channel.checkQueue(queue);
        observableResult.observe(messageCount, { queue });
      } catch (error) {
        logger.error(`Failed to check queue depth for ${queue}:`, error);
      }
    }
  };
  queueDepthGauge.addCallback(callback);

  return {
    channel,
    connection,
    recommendationQueue,
    siloQueue,
    close: async () => {
      queueDepthGauge.removeCallback(callback);
      await channel.close();
      await connection.close();
    },
  };
}
