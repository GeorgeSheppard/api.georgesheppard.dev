import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createDatabaseClient, DatabaseClient } from '@core/database/client.js';
import { recommendations, requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { App, createApp } from "../../src/server.js";
import { config } from "@config/index.js";
import { createQueueClient, QueueClient } from "@core/queue/client.js";
import { EmailClient } from '@core/utils/mailgun.js';
import { IpLocator } from '@core/utils/ip-locator.js';
import { createMockEmailClient } from '../mocks/email.js';
import { createMockIpLocator } from '../mocks/ip-locator.js';
import type { Recommendation } from '@core/types/index.js';

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
  app = await createApp(databaseClient, queueClient, emailClient, ipLocator);
});

afterAll(async () => {
  queueClient.close();
  databaseClient.close();
});

afterEach(async () => {
  await queueClient.channel.purgeQueue(queueClient.textExtractionQueue);
  await databaseClient.db.delete(requests);
});

describe('GET /api/recommendations/{id}', () => {
  // Validation tests
  it('should return an error if id is not a valid UUID', async () => {
    const response = await app.request(
      new Request(
        'http://localhost/api/recommendations/not-a-uuid',
        {
          method: 'GET',
        }
      )
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // 404 scenario: recommendation doesn't exist
  it('should return 404 if recommendation does not exist in DB', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await app.request(
      new Request(
        `http://localhost/api/recommendations/${nonExistentId}`,
        {
          method: 'GET',
        }
      )
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Recommendation not found');
    expect(body).toHaveProperty('success', false);
  });

  // 422 scenario: processedUtc exists but recommendations is null
  it('should return 422 if processedUtc exists but recommendations is null', async () => {
    // Create a request
    const requestResult = await databaseClient.db
      .insert(requests)
      .values({
        email: 'test@example.com',
      })
      .returning();

    const requestId = requestResult[0].id;

    // Create a recommendation with processedUtc but null recommendations
    const recommendationResult = await databaseClient.db
      .insert(recommendations)
      .values({
        requestId,
        processedUtc: new Date(),
        recommendations: null,
      })
      .returning();

    const recommendationId = recommendationResult[0].id;

    const response = await app.request(
      new Request(
        `http://localhost/api/recommendations/${recommendationId}`,
        {
          method: 'GET',
        }
      )
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toHaveProperty('error', "We couldn't create any recommendations for you. Please make sure your bookshelf is readable.");
    expect(body).toHaveProperty('success', false);

    // Cleanup
    await databaseClient.db
      .delete(recommendations)
      .where(eq(recommendations.id, recommendationId));
    await databaseClient.db
      .delete(requests)
      .where(eq(requests.id, requestId));
  });

  // 422 scenario: processedUtc exists but recommendations is empty array
  it('should return 422 if processedUtc exists but recommendations is empty array', async () => {
    // Create a request
    const requestResult = await databaseClient.db
      .insert(requests)
      .values({
        email: 'test2@example.com',
      })
      .returning();

    const requestId = requestResult[0].id;

    // Create a recommendation with processedUtc but empty recommendations array
    const recommendationResult = await databaseClient.db
      .insert(recommendations)
      .values({
        requestId,
        processedUtc: new Date(),
        recommendations: [],
      })
      .returning();

    const recommendationId = recommendationResult[0].id;

    const response = await app.request(
      new Request(
        `http://localhost/api/recommendations/${recommendationId}`,
        {
          method: 'GET',
        }
      )
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toHaveProperty('error', "We couldn't create any recommendations for you. Please make sure your bookshelf is readable.");
    expect(body).toHaveProperty('success', false);

    // Cleanup
    await databaseClient.db
      .delete(recommendations)
      .where(eq(recommendations.id, recommendationId));
    await databaseClient.db
      .delete(requests)
      .where(eq(requests.id, requestId));
  });

  // 200 scenario: successful retrieval with email and no frequency
  it('should return 200 with recommendations, hasEmail=true, isRecurringMonthly=false when request has email but no frequency', async () => {
    // Create a request with email but no frequency
    const requestResult = await databaseClient.db
      .insert(requests)
      .values({
        email: 'test3@example.com',
        frequency: null,
      })
      .returning();

    const requestId = requestResult[0].id;

    // Create a recommendation with valid recommendations
    const testRecommendations: Recommendation[] = [
      {
        name: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        reasonForRecommendation: 'Test Reason',
        amazonLink: 'https://amazon.com/test',
      },
    ];

    const recommendationResult = await databaseClient.db
      .insert(recommendations)
      .values({
        requestId,
        processedUtc: new Date(),
        recommendations: testRecommendations,
      })
      .returning();

    const recommendationId = recommendationResult[0].id;

    const response = await app.request(
      new Request(
        `http://localhost/api/recommendations/${recommendationId}`,
        {
          method: 'GET',
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('hasEmail', true);
    expect(body).toHaveProperty('isRecurringMonthly', false);
    expect(body).toHaveProperty('recommendations');
    expect(body.recommendations).toHaveLength(1);
    expect(body.recommendations[0]).toMatchObject(testRecommendations[0]);

    // Cleanup
    await databaseClient.db
      .delete(recommendations)
      .where(eq(recommendations.id, recommendationId));
    await databaseClient.db
      .delete(requests)
      .where(eq(requests.id, requestId));
  });

  // 200 scenario: successful retrieval with email and monthly frequency
  it('should return 200 with recommendations, hasEmail=true, isRecurringMonthly=true when request has monthly frequency', async () => {
    // Create a request with email and monthly frequency
    const requestResult = await databaseClient.db
      .insert(requests)
      .values({
        email: 'test4@example.com',
        frequency: 'M',
      })
      .returning();

    const requestId = requestResult[0].id;

    // Create a recommendation with valid recommendations
    const testRecommendations: Recommendation[] = [
      {
        name: 'Another Test Book',
        author: 'Another Test Author',
        description: 'Another Test Description',
        reasonForRecommendation: 'Another Test Reason',
        amazonLink: 'https://amazon.com/test2',
      },
    ];

    const recommendationResult = await databaseClient.db
      .insert(recommendations)
      .values({
        requestId,
        processedUtc: new Date(),
        recommendations: testRecommendations,
      })
      .returning();

    const recommendationId = recommendationResult[0].id;

    const response = await app.request(
      new Request(
        `http://localhost/api/recommendations/${recommendationId}`,
        {
          method: 'GET',
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('hasEmail', true);
    expect(body).toHaveProperty('isRecurringMonthly', true);
    expect(body).toHaveProperty('recommendations');
    expect(body.recommendations).toHaveLength(1);
    expect(body.recommendations[0]).toMatchObject(testRecommendations[0]);

    // Cleanup
    await databaseClient.db
      .delete(recommendations)
      .where(eq(recommendations.id, recommendationId));
    await databaseClient.db
      .delete(requests)
      .where(eq(requests.id, requestId));
  });

  // 200 scenario: successful retrieval without email
  it('should return 200 with recommendations, hasEmail=false, isRecurringMonthly=false when request has no email', async () => {
    // Create a request without email
    const requestResult = await databaseClient.db
      .insert(requests)
      .values({
        email: null,
      })
      .returning();

    const requestId = requestResult[0].id;

    // Create a recommendation with valid recommendations
    const testRecommendations: Recommendation[] = [
      {
        name: 'No Email Test Book',
        author: 'No Email Test Author',
        description: 'No Email Test Description',
        reasonForRecommendation: 'No Email Test Reason',
        amazonLink: 'https://amazon.com/test4',
      },
    ];

    const recommendationResult = await databaseClient.db
      .insert(recommendations)
      .values({
        requestId,
        processedUtc: new Date(),
        recommendations: testRecommendations,
      })
      .returning();

    const recommendationId = recommendationResult[0].id;

    const response = await app.request(
      new Request(
        `http://localhost/api/recommendations/${recommendationId}`,
        {
          method: 'GET',
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('hasEmail', false);
    expect(body).toHaveProperty('isRecurringMonthly', false);
    expect(body).toHaveProperty('recommendations');
    expect(body.recommendations).toHaveLength(1);
    expect(body.recommendations[0]).toMatchObject(testRecommendations[0]);

    // Cleanup
    await databaseClient.db
      .delete(recommendations)
      .where(eq(recommendations.id, recommendationId));
    await databaseClient.db
      .delete(requests)
      .where(eq(requests.id, requestId));
  });
});
