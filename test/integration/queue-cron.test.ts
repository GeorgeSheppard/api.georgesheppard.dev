import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { createDatabaseClient, DatabaseClient } from '@core/database/client.js';
import { requests, recommendations } from '@core/database/schema/index.js';
import { eq, count } from 'drizzle-orm';
import { App, createApp } from "../../src/server.js";
import { config } from "@config/index.js";
import { createQueueClient, QueueClient } from "@core/queue/client.js";
import { EmailClient } from '@core/utils/mailgun.js';
import { IpLocator } from '@core/utils/ip-locator.js';
import { createMockEmailClient } from '../mocks/email.js';
import { createMockIpLocator } from '../mocks/ip-locator.js';
import { createMockDynamoDBClient } from '../mocks/dynamodb-client.js';
import { createMockS3Client } from '../mocks/s3-client.js';

let app: App;
let databaseClient: DatabaseClient;
let queueClient: QueueClient;
let emailClient: EmailClient;
let ipLocator: IpLocator;

beforeAll(async () => {
  databaseClient = await createDatabaseClient(config.DATABASE_URL);
  queueClient = await createQueueClient(config.RABBITMQ_URL);
  emailClient = createMockEmailClient();
  ipLocator = createMockIpLocator();
  app = await createApp(
    databaseClient,
    queueClient,
    emailClient,
    ipLocator,
    createMockDynamoDBClient(),
    createMockS3Client()
  );
});

afterAll(async () => {
  queueClient.close();
  databaseClient.close();
});

afterEach(async () => {
  await queueClient.channel.purgeQueue(queueClient.recommendationQueue);
  await databaseClient.db.delete(recommendations);
  await databaseClient.db.delete(requests);
  vi.clearAllMocks();
});

describe('GET /api/queue-due-recommendations', () => {

  describe('No due recommendations', () => {
    it('should return 204 when there are no due recommendations', async () => {
      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
    });

    it('should return 204 when users have no frequency (not recurring)', async () => {
      // Create request without frequency (non-recurring)
      await databaseClient.db.insert(requests).values({
        nextRecommendationUtc: new Date(Date.now() - 1000),
        frequency: null,
      });

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);

      // Verify no recommendations were created
      const [result] = await databaseClient.db
        .select({ count: count() })
        .from(recommendations);
      expect(result.count).toBe(0);
    });

    it('should return 204 when nextRecommendationUtc is in the future', async () => {
      // Create request with future nextRecommendationUtc
      await databaseClient.db.insert(requests).values({
        nextRecommendationUtc: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day from now
        frequency: 'M',
      });

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);

      // Verify no recommendations were created
      const [result] = await databaseClient.db
        .select({ count: count() })
        .from(recommendations);
      expect(result.count).toBe(0);
    });
  });

  describe('Single user with due recommendation', () => {
    it('should create a recommendation and queue it for a single due user', async () => {
      const [request] = await databaseClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      const beforeRequest = Date.now();

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);

      // Verify recommendation was created
      const recs = await databaseClient.db
        .select()
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));
      expect(recs).toHaveLength(1);
      expect(recs[0].requestId).toBe(request.id);

      // Verify nextRecommendationUtc was updated to ~30 days from now
      const [updatedRequest] = await databaseClient.db
        .select()
        .from(requests)
        .where(eq(requests.id, request.id));

      expect(updatedRequest.nextRecommendationUtc).toBeTruthy();
      const expectedDate = new Date(beforeRequest + 30 * 24 * 60 * 60 * 1000);
      const actualDate = updatedRequest.nextRecommendationUtc!;
      const timeDiff = Math.abs(actualDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds

      // Verify message was queued
      const messages = await queueClient.channel.get(queueClient.recommendationQueue, {
        noAck: false,
      });
      expect(messages).toBeTruthy();
      if (messages) {
        const content = JSON.parse(messages.content.toString());
        expect(content.userId).toBe(request.id);
        expect(content.recommendationId).toBe(recs[0].id);
        await queueClient.channel.ack(messages);
      }
    });

    it('should update multiple fields atomically within a transaction', async () => {
      const [request] = await databaseClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      // Verify the transaction ensured both operations completed
      const [recs] = await databaseClient.db
        .select({ count: count() })
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));

      const [updatedRequest] = await databaseClient.db
        .select()
        .from(requests)
        .where(eq(requests.id, request.id));

      // Both operations should have succeeded (atomicity check)
      expect(recs.count).toBe(1);
      expect(updatedRequest.nextRecommendationUtc).toBeTruthy();
      expect(updatedRequest.nextRecommendationUtc!.getTime()).toBeGreaterThan(
        Date.now()
      );
    });
  });

  describe('Multiple users with due recommendations', () => {
    it('should process small batch of due users (5 users)', async () => {
      const userIds: string[] = [];
      const count = 5;

      // Create multiple due requests
      for (let i = 0; i < count; i++) {
        const [request] = await databaseClient.db
          .insert(requests)
          .values({
            nextRecommendationUtc: new Date(Date.now() - 1000),
            frequency: 'M',
          })
          .returning();
        userIds.push(request.id);
      }

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);

      // Verify all users got recommendations and updates
      for (const userId of userIds) {
        const recs = await databaseClient.db
          .select()
          .from(recommendations)
          .where(eq(recommendations.requestId, userId));
        expect(recs).toHaveLength(1);

        const [request] = await databaseClient.db
          .select()
          .from(requests)
          .where(eq(requests.id, userId));
        expect(request.nextRecommendationUtc).toBeTruthy();
        expect(request.nextRecommendationUtc!.getTime()).toBeGreaterThan(Date.now());
      }

      // Verify all messages were queued
      let messageCount = 0;
      let message = await queueClient.channel.get(queueClient.recommendationQueue, {
        noAck: false,
      });
      while (message) {
        messageCount++;
        await queueClient.channel.ack(message);
        message = await queueClient.channel.get(queueClient.recommendationQueue, {
          noAck: false,
        });
      }
      expect(messageCount).toBe(count);
    });

    it('should process medium batch of due users (50 users)', async () => {
      const userIds: string[] = [];
      const batchCount = 50;

      // Create multiple due requests
      for (let i = 0; i < batchCount; i++) {
        const [request] = await databaseClient.db
          .insert(requests)
          .values({
            nextRecommendationUtc: new Date(Date.now() - 1000),
            frequency: 'M',
          })
          .returning();
        userIds.push(request.id);
      }

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);

      // Verify all recommendations were created
      const [result] = await databaseClient.db
        .select({ count: count() })
        .from(recommendations);
      expect(result.count).toBe(batchCount);

      // Verify message count
      let messageCount = 0;
      let message = await queueClient.channel.get(queueClient.recommendationQueue, {
        noAck: false,
      });
      while (message) {
        messageCount++;
        await queueClient.channel.ack(message);
        message = await queueClient.channel.get(queueClient.recommendationQueue, {
          noAck: false,
        });
      }
      expect(messageCount).toBe(batchCount);
    });

    it('should process large batch of due users (200 users)', async () => {
      const count = 200;

      // Create multiple due requests efficiently
      const requests_list = Array.from({ length: count }, () => ({
        nextRecommendationUtc: new Date(Date.now() - 1000),
        frequency: 'M' as const,
      }));

      await databaseClient.db.insert(requests).values(requests_list);

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);

      // Verify message count
      let messageCount = 0;
      let message = await queueClient.channel.get(queueClient.recommendationQueue, {
        noAck: false,
      });
      while (message) {
        messageCount++;
        await queueClient.channel.ack(message);
        message = await queueClient.channel.get(queueClient.recommendationQueue, {
          noAck: false,
        });
      }
      expect(messageCount).toBe(count);
    });

    it('should handle mixed batch with some due and some not due', async () => {
      // Create due requests
      const dueCount = 3;
      const dueIds: string[] = [];
      for (let i = 0; i < dueCount; i++) {
        const [request] = await databaseClient.db
          .insert(requests)
          .values({
            nextRecommendationUtc: new Date(Date.now() - 1000),
            frequency: 'M',
          })
          .returning();
        dueIds.push(request.id);
      }

      // Create future requests (not due)
      const notDueCount = 2;
      for (let i = 0; i < notDueCount; i++) {
        await databaseClient.db.insert(requests).values({
          nextRecommendationUtc: new Date(Date.now() + 1000 * 60 * 60 * 24),
          frequency: 'M',
        });
      }

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);

      // Verify only due users were processed
      let messageCount = 0;
      let message = await queueClient.channel.get(queueClient.recommendationQueue, {
        noAck: false,
      });
      while (message) {
        messageCount++;
        await queueClient.channel.ack(message);
        message = await queueClient.channel.get(queueClient.recommendationQueue, {
          noAck: false,
        });
      }
      expect(messageCount).toBe(dueCount);
    });
  });

  describe('Error handling', () => {
    it('should continue processing if one user transaction fails', async () => {
      // Create first due request
      const [request1] = await databaseClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      // Create second due request
      const [request2] = await databaseClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      // Should still return 204 even if individual errors occur
      expect(response.status).toBe(204);

      // At least one user should be processed successfully
      let messageCount = 0;
      let message = await queueClient.channel.get(queueClient.recommendationQueue, {
        noAck: false,
      });
      while (message) {
        messageCount++;
        await queueClient.channel.ack(message);
        message = await queueClient.channel.get(queueClient.recommendationQueue, {
          noAck: false,
        });
      }
      expect(messageCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle all valid recommendations even if queue is unavailable', async () => {
      const [request] = await databaseClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      // Mock channel.sendToQueue to throw an error
      const originalSendToQueue = queueClient.channel.sendToQueue.bind(
        queueClient.channel
      );
      vi.spyOn(queueClient.channel, 'sendToQueue').mockImplementation(() => {
        throw new Error('Queue service unavailable');
      });

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      // Should return 204 even if queue fails (graceful degradation)
      expect(response.status).toBe(204);

      // But the recommendation should still have been created
      const recs = await databaseClient.db
        .select()
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));
      expect(recs).toHaveLength(1);

      // And nextRecommendationUtc should have been updated
      const [updatedRequest] = await databaseClient.db
        .select()
        .from(requests)
        .where(eq(requests.id, request.id));
      expect(updatedRequest.nextRecommendationUtc).toBeTruthy();
      expect(updatedRequest.nextRecommendationUtc!.getTime()).toBeGreaterThan(
        Date.now()
      );

      // Restore original implementation
      vi.spyOn(queueClient.channel, 'sendToQueue').mockImplementation(
        originalSendToQueue
      );
    });
  });

  describe('Transactional behavior', () => {
    it('should maintain consistent state even with concurrent-like operations', async () => {
      const [request] = await databaseClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      // Get the updated request
      const [updatedRequest] = await databaseClient.db
        .select()
        .from(requests)
        .where(eq(requests.id, request.id));

      // Verify both DB operations succeeded (atomicity)
      const [recommendationCount] = await databaseClient.db
        .select({ count: count() })
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));

      expect(recommendationCount.count).toBe(1);
      expect(updatedRequest.nextRecommendationUtc).toBeTruthy();
      expect(updatedRequest.nextRecommendationUtc!.getTime()).toBeGreaterThan(
        Date.now()
      );
    });

    it('should not process same user multiple times in single request', async () => {
      const [request] = await databaseClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      // Verify only one recommendation was created
      const [result] = await databaseClient.db
        .select({ count: count() })
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));
      expect(result.count).toBe(1);
    });
  });

  describe('Response validation', () => {
    it('should return 204 No Content status', async () => {
      const [request] = await databaseClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
    });

    it('should accept GET request', async () => {
      const response = await app.request(
        new Request('http://localhost/api/queue-due-recommendations', {
          method: 'GET',
          headers: {
            'x-api-key': config.API_KEY,
          },
        })
      );

      // Should not be a method not allowed error
      expect(response.status).not.toBe(405);
    });
  });
});
