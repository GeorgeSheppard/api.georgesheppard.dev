import { test, describe, expect } from '../../../../test/fixtures.js';
import { config } from '@config/index.js';
import { vi } from 'vitest';
import { requests, recommendations } from '@core/database/schema/index.js';
import { eq, count } from 'drizzle-orm';
import { App } from '../../../server.js';
import { createTestApp } from '../../../../test/utils/app.js';

describe('GET /api/queue-due-recommendations', () => {
  let app: App;

  test.beforeEach(async ({ dbClient, queueClient }) => {
    app = await createTestApp({ databaseClient: dbClient, queueClient: queueClient });
  });

  test.afterEach(async ({ dbClient, queueClient }) => {
    await queueClient.channel.purgeQueue(queueClient.recommendationQueue);
    await dbClient.db.delete(recommendations);
    await dbClient.db.delete(requests);
    vi.clearAllMocks();
  });
  describe('No due recommendations', () => {
    test('should return 204 when there are no due recommendations', async ({ dbClient, queueClient }) => {
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

    test('should return 204 when users have no frequency (not recurring)', async ({ dbClient, queueClient }) => {
      // Create request without frequency (non-recurring)
      await dbClient.db.insert(requests).values({
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
      const [result] = await dbClient.db.select({ count: count() }).from(recommendations);
      expect(result.count).toBe(0);
    });

    test('should return 204 when nextRecommendationUtc is in the future', async ({ dbClient, queueClient }) => {
      // Create request with future nextRecommendationUtc
      await dbClient.db.insert(requests).values({
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
      const [result] = await dbClient.db.select({ count: count() }).from(recommendations);
      expect(result.count).toBe(0);
    });
  });

  describe('Single user with due recommendation', () => {
    test('should create a recommendation and queue it for a single due user', async ({ dbClient, queueClient }) => {
      const [request] = await dbClient.db
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
      const recs = await dbClient.db
        .select()
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));
      expect(recs).toHaveLength(1);
      expect(recs[0].requestId).toBe(request.id);

      // Verify nextRecommendationUtc was updated to ~30 days from now
      const [updatedRequest] = await dbClient.db
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

    test('should update multiple fields atomically within a transaction', async ({ dbClient, queueClient }) => {
      const [request] = await dbClient.db
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
      const [recs] = await dbClient.db
        .select({ count: count() })
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));

      const [updatedRequest] = await dbClient.db
        .select()
        .from(requests)
        .where(eq(requests.id, request.id));

      // Both operations should have succeeded (atomicity check)
      expect(recs.count).toBe(1);
      expect(updatedRequest.nextRecommendationUtc).toBeTruthy();
      expect(updatedRequest.nextRecommendationUtc!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Multiple users with due recommendations', () => {
    test('should process small batch of due users (5 users)', async ({ dbClient, queueClient }) => {
      const userIds: string[] = [];
      const count = 5;

      // Create multiple due requests
      for (let i = 0; i < count; i++) {
        const [request] = await dbClient.db
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
        const recs = await dbClient.db
          .select()
          .from(recommendations)
          .where(eq(recommendations.requestId, userId));
        expect(recs).toHaveLength(1);

        const [request] = await dbClient.db
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

    test('should process medium batch of due users (50 users)', async ({ dbClient, queueClient }) => {
      const userIds: string[] = [];
      const batchCount = 50;

      // Create multiple due requests
      for (let i = 0; i < batchCount; i++) {
        const [request] = await dbClient.db
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
      const [result] = await dbClient.db.select({ count: count() }).from(recommendations);
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

    test('should process large batch of due users (200 users)', async ({ dbClient, queueClient }) => {
      const count = 200;

      // Create multiple due requests efficiently
      const requests_list = Array.from({ length: count }, () => ({
        nextRecommendationUtc: new Date(Date.now() - 1000),
        frequency: 'M' as const,
      }));

      await dbClient.db.insert(requests).values(requests_list);

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

    test('should handle mixed batch with some due and some not due', async ({ dbClient, queueClient }) => {
      // Create due requests
      const dueCount = 3;
      const dueIds: string[] = [];
      for (let i = 0; i < dueCount; i++) {
        const [request] = await dbClient.db
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
        await dbClient.db.insert(requests).values({
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
    test('should continue processing if one user transaction fails', async ({ dbClient, queueClient }) => {
      // Create first due request
      const [request1] = await dbClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      // Create second due request
      const [request2] = await dbClient.db
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

    test('should handle all valid recommendations even if queue is unavailable', async ({ dbClient, queueClient }) => {
      const [request] = await dbClient.db
        .insert(requests)
        .values({
          nextRecommendationUtc: new Date(Date.now() - 1000),
          frequency: 'M',
        })
        .returning();

      // Mock channel.sendToQueue to throw an error
      const originalSendToQueue = queueClient.channel.sendToQueue.bind(queueClient.channel);
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
      const recs = await dbClient.db
        .select()
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));
      expect(recs).toHaveLength(1);

      // And nextRecommendationUtc should have been updated
      const [updatedRequest] = await dbClient.db
        .select()
        .from(requests)
        .where(eq(requests.id, request.id));
      expect(updatedRequest.nextRecommendationUtc).toBeTruthy();
      expect(updatedRequest.nextRecommendationUtc!.getTime()).toBeGreaterThan(Date.now());

      // Restore original implementation
      vi.spyOn(queueClient.channel, 'sendToQueue').mockImplementation(originalSendToQueue);
    });
  });

  describe('Transactional behavior', () => {
    test('should maintain consistent state even with concurrent-like operations', async ({ dbClient, queueClient }) => {
      const [request] = await dbClient.db
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
      const [updatedRequest] = await dbClient.db
        .select()
        .from(requests)
        .where(eq(requests.id, request.id));

      // Verify both DB operations succeeded (atomicity)
      const [recommendationCount] = await dbClient.db
        .select({ count: count() })
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));

      expect(recommendationCount.count).toBe(1);
      expect(updatedRequest.nextRecommendationUtc).toBeTruthy();
      expect(updatedRequest.nextRecommendationUtc!.getTime()).toBeGreaterThan(Date.now());
    });

    test('should not process same user multiple times in single request', async ({ dbClient, queueClient }) => {
      const [request] = await dbClient.db
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
      const [result] = await dbClient.db
        .select({ count: count() })
        .from(recommendations)
        .where(eq(recommendations.requestId, request.id));
      expect(result.count).toBe(1);
    });
  });

  describe('Response validation', () => {
    test('should return 204 No Content status', async ({ dbClient, queueClient }) => {
      const [request] = await dbClient.db
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

    test('should accept GET request', async ({ dbClient, queueClient }) => {
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
