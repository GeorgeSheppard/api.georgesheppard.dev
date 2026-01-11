import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createDatabaseClient, DatabaseClient } from '@core/database/client.js';
import { requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { App, createApp } from "../../src/server.js";
import { config } from "@config/index.js";
import { createQueueClient, QueueClient } from "@core/queue/client.js";
import { EmailClient } from '@core/utils/mailgun.js';
import { IpLocator } from '@core/utils/ip-locator.js';
import { createMockEmailClient } from '../mocks/email.js';
import { createMockIpLocator } from '../mocks/ip-locator.js';

let app: App;
let databaseClient: DatabaseClient
let queueClient: QueueClient
let emailClient: EmailClient
let ipLocator: IpLocator

beforeAll(async () => {
  databaseClient = await createDatabaseClient(config.DATABASE_URL)
  queueClient = await createQueueClient(config.RABBITMQ_URL)
  emailClient = createMockEmailClient()
  ipLocator = createMockIpLocator()
  app = await createApp(databaseClient, queueClient, emailClient, ipLocator)
});

afterAll(async () => {
  queueClient.close()
  databaseClient.close()
});

afterEach(async () => {
  await queueClient.channel.purgeQueue(queueClient.textExtractionQueue);
  await databaseClient.db.delete(requests);
});

describe('DELETE /api/recommendations/delete-email', () => {
  it('should return an error if requestId is not a valid UUID', async () => {
    const response = await app.request(
      new Request(
        'http://localhost/api/recommendations/delete-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'requestId=not-a-uuid',
        }
      )
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('should return 200 and not modify anything if requestId does not exist in DB', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await app.request(
      new Request(
        'http://localhost/api/recommendations/delete-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `requestId=${nonExistentId}`,
        }
      )
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({});

    // Verify no request was created or modified
    const requestCount = await databaseClient.db.select().from(requests).where(eq(requests.id, nonExistentId));
    expect(requestCount).toHaveLength(0);
  });

  it('should delete email and related fields if requestId exists in DB', async () => {
    // Create a request with email and frequency
    const testEmail = 'test@example.com';
    const testFrequency = 'week';
    const testDate = new Date('2025-02-15T10:00:00Z');

    const result = await databaseClient.db
      .insert(requests)
      .values({
        email: testEmail,
        frequency: testFrequency,
        nextRecommendationUtc: testDate,
      })
      .returning();

    const requestId = result[0].id;

    // Verify request was created with email
    let dbRequest = await databaseClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId));

    expect(dbRequest[0].email).toBe(testEmail);
    expect(dbRequest[0].frequency).toBe(testFrequency);
    expect(dbRequest[0].nextRecommendationUtc).toEqual(testDate);

    // Call the endpoint
    const response = await app.request(
      new Request(
        'http://localhost/api/recommendations/delete-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `requestId=${requestId}`,
        }
      )
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({});

    // Verify email and related fields were deleted
    dbRequest = await databaseClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId));

    expect(dbRequest[0].email).toBeNull();
    expect(dbRequest[0].frequency).toBeNull();
    expect(dbRequest[0].nextRecommendationUtc).toBeNull();
  });

  it('should return correct response object on successful validation', async () => {
    const result = await databaseClient.db
      .insert(requests)
      .values({
        email: 'test2@example.com',
      })
      .returning();

    const requestId = result[0].id;

    const response = await app.request(
      new Request(
        'http://localhost/api/recommendations/delete-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `requestId=${requestId}`,
        }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const responseBody = await response.json();
    expect(responseBody).toStrictEqual({});
    expect(typeof responseBody).toBe('object');
  });

  it('should return an error if requestId is missing from request', async () => {
    const response = await app.request(
      new Request(
        'http://localhost/api/recommendations/delete-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: '',
        }
      )
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
