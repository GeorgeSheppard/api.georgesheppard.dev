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

export interface QueueClient {
  channel: amqp.Channel;
  connection: amqp.ChannelModel;
  recommendationQueue: string;
  close(): Promise<void>;
}

export async function createQueueClient(url: string): Promise<QueueClient> {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  // Declare queues
  const recommendationQueue = 'recommendations';

  await channel.assertQueue(recommendationQueue, { durable: true });

  const callback = async (observableResult: ObservableResult) => {
    for (const queue of [recommendationQueue]) {
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
    close: async () => {
      queueDepthGauge.removeCallback(callback);
      await channel.close();
      await connection.close();
    },
  };
}
