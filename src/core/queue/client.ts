import amqp from 'amqplib';

export interface TextExtractionJob {
  userId: string;
  recommendationId: string;
}

export interface RecommendationJob {
  userId: string;
  recommendationId: string;
}

export interface QueueClient {
  channel: amqp.Channel;
  connection: amqp.ChannelModel;
  textExtractionQueue: string;
  recommendationQueue: string;
  close(): Promise<void>;
}

export async function createQueueClient(url: string): Promise<QueueClient> {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  // Declare queues
  const textExtractionQueue = 'text-extraction';
  const recommendationQueue = 'recommendations';

  await channel.assertQueue(textExtractionQueue, { durable: true });
  await channel.assertQueue(recommendationQueue, { durable: true });

  const client: QueueClient = {
    channel: channel,
    connection: connection,
    textExtractionQueue,
    recommendationQueue,
    close: async () => {
      await channel.close();
      await connection.close();
    },
  };

  return client;
}
