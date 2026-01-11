import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createDatabaseClient, DatabaseClient } from '@core/database/client.js';
import { recommendations, requests, images } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { App, createApp } from '../../src/server.js';
import { config } from '@config/index.js';
import { createQueueClient, QueueClient } from '@core/queue/client.js';
import { EmailClient } from '@core/utils/mailgun.js';
import { IpLocator } from '@core/utils/ip-locator.js';
import { createMockEmailClient } from '../mocks/email.js';
import { createMockIpLocator } from '../mocks/ip-locator.js';

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

describe('POST /api/recommendations/from-bookcase', () => {
  it('should return 400 error when no files are provided', async () => {
    const formData = new FormData();

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error', 'No files uploaded');
  });

  it('should successfully process a single image file', async () => {
    // Create a test image file
    const testImageData = Buffer.from('fake-image-data-1');
    const blob = new Blob([testImageData], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('bookcase', blob, 'bookcase1.jpg');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.1', // Test IP for location
        },
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('id');
    expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // Verify recommendation was created
    const recommendation = await databaseClient.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, body.id))
      .limit(1);

    expect(recommendation).toHaveLength(1);
    expect(recommendation[0]).toHaveProperty('requestId');

    const requestId = recommendation[0].requestId;

    // Verify request was created with correct data
    const request = await databaseClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);

    expect(request).toHaveLength(1);
    expect(request[0].createdUtc).toBeInstanceOf(Date);
    expect(request[0].location).toBeTruthy();
    expect(request[0].location).toBe('Us'); // Default fallback for invalid IP

    // Verify image was stored
    const storedImages = await databaseClient.db
      .select()
      .from(images)
      .where(eq(images.requestId, requestId));

    expect(storedImages).toHaveLength(1);
    expect(storedImages[0].contentType).toBe('image/jpeg');
    expect(storedImages[0].image).toBeInstanceOf(Buffer);
    expect(storedImages[0].image.toString()).toContain('fake-image-data-1');
  });

  it('should successfully process multiple image files', async () => {
    // Create multiple test image files
    const testImageData1 = Buffer.from('fake-image-data-1');
    const testImageData2 = Buffer.from('fake-image-data-2');
    const testImageData3 = Buffer.from('fake-image-data-3');

    const blob1 = new Blob([testImageData1], { type: 'image/jpeg' });
    const blob2 = new Blob([testImageData2], { type: 'image/png' });
    const blob3 = new Blob([testImageData3], { type: 'image/webp' });

    const formData = new FormData();
    formData.append('bookcase', blob1, 'bookcase1.jpg');
    formData.append('bookcase', blob2, 'bookcase2.png');
    formData.append('bookcase', blob3, 'bookcase3.webp');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '8.8.8.8', // US IP
        },
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('id');

    // Verify recommendation was created
    const recommendation = await databaseClient.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, body.id))
      .limit(1);

    expect(recommendation).toHaveLength(1);
    const requestId = recommendation[0].requestId;

    // Verify all images were stored
    const storedImages = await databaseClient.db
      .select()
      .from(images)
      .where(eq(images.requestId, requestId));

    expect(storedImages).toHaveLength(3);

    // Verify each image has correct data
    const imageTypes = storedImages.map(img => img.contentType).sort();
    expect(imageTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);

    const imageContents = storedImages.map(img => img.image.toString());
    expect(imageContents).toContain('fake-image-data-1');
    expect(imageContents).toContain('fake-image-data-2');
    expect(imageContents).toContain('fake-image-data-3');
  });

  it('should create request record with correct location from x-forwarded-for header', async () => {
    const testImageData = Buffer.from('fake-image-data');
    const blob = new Blob([testImageData], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('bookcase', blob, 'test.jpg');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '1.1.1.1', // Test IP - will default to US
        },
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;

    // Get the request to verify location
    const recommendation = await databaseClient.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, body.id))
      .limit(1);

    const request = await databaseClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, recommendation[0].requestId))
      .limit(1);

    expect(request[0].location).toBeTruthy();
    expect(typeof request[0].location).toBe('string');
  });

  it('should create request record with default location when no x-forwarded-for header', async () => {
    const testImageData = Buffer.from('fake-image-data');
    const blob = new Blob([testImageData], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('bookcase', blob, 'test.jpg');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;

    // Get the request to verify location
    const recommendation = await databaseClient.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, body.id))
      .limit(1);

    const request = await databaseClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, recommendation[0].requestId))
      .limit(1);

    expect(request[0].location).toBe('Us'); // Default location
  });

  it('should create recommendation linked to the request', async () => {
    const testImageData = Buffer.from('fake-image-data');
    const blob = new Blob([testImageData], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('bookcase', blob, 'test.jpg');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;

    // Verify recommendation is linked to request
    const recommendation = await databaseClient.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, body.id))
      .limit(1);

    expect(recommendation).toHaveLength(1);
    expect(recommendation[0].requestId).toBeTruthy();
    expect(recommendation[0].recommendations).toBeNull(); // Not processed yet
    expect(recommendation[0].processedUtc).toBeNull(); // Not processed yet

    // Verify the request exists
    const request = await databaseClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, recommendation[0].requestId))
      .limit(1);

    expect(request).toHaveLength(1);
  });

  it('should send message to text extraction queue with correct data', async () => {
    // First, consume any existing messages from the queue to clear it
    await queueClient.channel.purgeQueue(queueClient.textExtractionQueue);

    const testImageData = Buffer.from('fake-image-data');
    const blob = new Blob([testImageData], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('bookcase', blob, 'test.jpg');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;

    // Get the recommendation to verify IDs
    const recommendation = await databaseClient.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, body.id))
      .limit(1);

    const requestId = recommendation[0].requestId;

    // Consume message from queue and verify its contents
    const message = await queueClient.channel.get(queueClient.textExtractionQueue);

    expect(message).not.toBe(false);
    if (message) {
      const messageContent = JSON.parse(message.content.toString());
      expect(messageContent).toHaveProperty('userId', requestId);
      expect(messageContent).toHaveProperty('recommendationId', body.id);

      // Acknowledge the message
      queueClient.channel.ack(message);
    }
  });

  it('should handle files with different content types', async () => {
    const jpegData = Buffer.from('jpeg-data');
    const pngData = Buffer.from('png-data');

    const jpegBlob = new Blob([jpegData], { type: 'image/jpeg' });
    const pngBlob = new Blob([pngData], { type: 'image/png' });

    const formData = new FormData();
    formData.append('bookcase', jpegBlob, 'image.jpg');
    formData.append('bookcase', pngBlob, 'image.png');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;

    const recommendation = await databaseClient.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, body.id))
      .limit(1);

    const storedImages = await databaseClient.db
      .select()
      .from(images)
      .where(eq(images.requestId, recommendation[0].requestId));

    expect(storedImages).toHaveLength(2);

    const contentTypes = storedImages.map(img => img.contentType).sort();
    expect(contentTypes).toEqual(['image/jpeg', 'image/png']);
  });

  it('should return recommendation ID in the expected UUID format', async () => {
    const testImageData = Buffer.from('fake-image-data');
    const blob = new Blob([testImageData], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('bookcase', blob, 'test.jpg');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json() as any;

    expect(body.id).toBeTruthy();
    // UUID v4 format
    expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should create request with current timestamp', async () => {
    const beforeRequest = new Date();

    const testImageData = Buffer.from('fake-image-data');
    const blob = new Blob([testImageData], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('bookcase', blob, 'test.jpg');

    const response = await app.request(
      new Request('http://localhost/api/recommendations/from-bookcase', {
        method: 'POST',
        body: formData,
      })
    );

    const afterRequest = new Date();

    expect(response.status).toBe(200);
    const body = await response.json() as any;

    const recommendation = await databaseClient.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, body.id))
      .limit(1);

    const request = await databaseClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, recommendation[0].requestId))
      .limit(1);

    const createdUtc = request[0].createdUtc;
    expect(createdUtc).toBeInstanceOf(Date);
    expect(createdUtc.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000);
    expect(createdUtc.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000);
  });
});
