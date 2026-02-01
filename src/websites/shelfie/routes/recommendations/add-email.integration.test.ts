import { test, describe, expect } from '../../../../../test/fixtures.js';
import { vi } from 'vitest';
import { requests, recommendations } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { App } from '../../../../server.js';
import { createMockEmailClient } from '../../../../../test/mocks/email.js';
import { createTestApp } from '../../../../../test/utils/app.js';
import { encryption } from '@core/utils/encryption.js';

describe('POST /api/recommendations/add-email', () => {
  let app: App;
  let emailClient = createMockEmailClient();

  test.beforeEach(async ({ dbClient, queueClient }) => {
    emailClient = createMockEmailClient();
    app = await createTestApp({ databaseClient: dbClient, queueClient: queueClient, emailClient });
  });

  test.afterEach(async ({ dbClient, queueClient }) => {
    await queueClient.channel.purgeQueue(queueClient.textExtractionQueue);
    await dbClient.db.delete(requests);
    vi.clearAllMocks();
  });
  // Validation tests
  test('should return an error if id is not a valid UUID', async ({ dbClient, queueClient }) => {
    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'id=not-a-uuid',
      })
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return an error if id is missing from request', async ({ dbClient, queueClient }) => {
    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: '',
      })
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return an error if email is provided but not valid', async ({ dbClient, queueClient }) => {
    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'id=550e8400-e29b-41d4-a716-446655440000&email=invalid-email',
      })
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // Edge case tests
  test('should return 404 if recommendation does not exist', async ({ dbClient, queueClient }) => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${nonExistentId}&email=test@example.com`,
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: 'Recommendation not found', success: false });
  });

  test('should return 400 if no email provided and request has no email', async ({ dbClient, queueClient }) => {
    // Create a request without email
    const [request] = await dbClient.db.insert(requests).values({}).returning();

    // Create a recommendation
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
      })
      .returning();

    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}`,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'No email provided', success: false });
  });

  // Success tests - recommendations not done yet
  test('should store encrypted email when recommendations are not done and no email provided', async ({ dbClient, queueClient }) => {
    const testEmail = 'existing@example.com';
    const encryptedEmail = encryption.encrypt(testEmail);

    // Create a request with encrypted email
    const [request] = await dbClient.db
      .insert(requests)
      .values({
        email: encryptedEmail,
      })
      .returning();

    // Create a recommendation without processed data
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
        processedUtc: null,
        recommendations: null,
      })
      .returning();

    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}`,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });

    // Verify email was stored (encrypted)
    const [updatedRequest] = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, request.id));

    expect(updatedRequest.email).toBeTruthy();
    const decryptedEmail = encryption.decrypt(updatedRequest.email!);
    expect(decryptedEmail).toBe(testEmail);
    expect(updatedRequest.frequency).toBeNull();
    expect(updatedRequest.nextRecommendationUtc).toBeNull();

    // Verify email was not sent
    expect(emailClient.sendRecommendationsEmail).not.toHaveBeenCalled();
  });

  test('should store new encrypted email when provided and recommendations are not done', async ({ dbClient, queueClient }) => {
    const newEmail = 'newemail@example.com';

    // Create a request without email
    const [request] = await dbClient.db.insert(requests).values({}).returning();

    // Create a recommendation without processed data
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
        processedUtc: null,
        recommendations: null,
      })
      .returning();

    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}&email=${newEmail}`,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });

    // Verify email was stored (encrypted)
    const [updatedRequest] = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, request.id));

    expect(updatedRequest.email).toBeTruthy();
    const decryptedEmail = encryption.decrypt(updatedRequest.email!);
    expect(decryptedEmail).toBe(newEmail);

    // Verify email was not sent
    expect(emailClient.sendRecommendationsEmail).not.toHaveBeenCalled();
  });

  // Success tests - recommendations already done, no recurring
  test('should not store email when recommendations are done and recurring is false', async ({ dbClient, queueClient }) => {
    const testEmail = 'test@example.com';
    const encryptedEmail = encryption.encrypt(testEmail);

    // Create a request with email
    const [request] = await dbClient.db
      .insert(requests)
      .values({
        email: encryptedEmail,
      })
      .returning();

    // Create a recommendation WITH processed data
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
        processedUtc: new Date(),
        recommendations: [
          {
            name: 'Test Book',
            author: 'Test Author',
            description: 'A test book',
            reason: 'Testing',
            amazonLink: 'https://amazon.com/test',
          },
        ],
      })
      .returning();

    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}&recurring=false`,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });

    // Verify email was NOT stored (set to null)
    const [updatedRequest] = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, request.id));

    expect(updatedRequest.email).toBeNull();
    expect(updatedRequest.frequency).toBeNull();
    expect(updatedRequest.nextRecommendationUtc).toBeNull();

    // Verify email was sent immediately
    expect(emailClient.sendRecommendationsEmail).toHaveBeenCalledWith({
      from: 'Shelfie <postmaster@mailgun.shelfie.georgesheppard.dev>',
      to: [testEmail],
      subject: 'Your Shelfie recommendations are here!',
      template: 'recommendations',
      variables: {
        recommendationsurl: `https://shelfie.georgesheppard.dev/recommendations/${recommendation.id}`,
        unsubscribeUrl: `https://shelfie.georgesheppard.dev/unsubscribe/${request.id}`,
        unsubscribeText: '',
      },
    });
  });

  test('should send email immediately when recommendations are done even if email sending fails', async ({ dbClient, queueClient }) => {
    const testEmail = 'test@example.com';
    const encryptedEmail = encryption.encrypt(testEmail);

    // Mock email client to throw error
    vi.mocked(emailClient.sendRecommendationsEmail).mockRejectedValueOnce(
      new Error('Email service error')
    );

    // Create a request with email
    const [request] = await dbClient.db
      .insert(requests)
      .values({
        email: encryptedEmail,
      })
      .returning();

    // Create a recommendation WITH processed data
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
        processedUtc: new Date(),
        recommendations: [
          {
            name: 'Test Book',
            author: 'Test Author',
            description: 'A test book',
            reason: 'Testing',
            amazonLink: 'https://amazon.com/test',
          },
        ],
      })
      .returning();

    // Should still return success even if email fails
    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}`,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });

    // Verify email sending was attempted
    expect(emailClient.sendRecommendationsEmail).toHaveBeenCalled();
  });

  // Success tests - recommendations already done, with recurring
  test('should store email and set recurring when recommendations are done and recurring is true', async ({ dbClient, queueClient }) => {
    const testEmail = 'recurring@example.com';
    const encryptedEmail = encryption.encrypt(testEmail);

    // Create a request with email
    const [request] = await dbClient.db
      .insert(requests)
      .values({
        email: encryptedEmail,
      })
      .returning();

    // Create a recommendation WITH processed data
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
        processedUtc: new Date(),
        recommendations: [
          {
            name: 'Test Book',
            author: 'Test Author',
            description: 'A test book',
            reason: 'Testing',
            amazonLink: 'https://amazon.com/test',
          },
        ],
      })
      .returning();

    const beforeRequest = Date.now();

    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}&recurring=true`,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });

    // Verify email was stored (encrypted)
    const [updatedRequest] = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, request.id));

    expect(updatedRequest.email).toBeTruthy();
    const decryptedEmail = encryption.decrypt(updatedRequest.email!);
    expect(decryptedEmail).toBe(testEmail);
    expect(updatedRequest.frequency).toBe('M');
    expect(updatedRequest.nextRecommendationUtc).toBeTruthy();

    // Verify nextRecommendationUtc is approximately 1 month in the future
    const expectedDate = new Date(beforeRequest + 30 * 24 * 60 * 60 * 1000);
    const actualDate = updatedRequest.nextRecommendationUtc!;
    const timeDiff = Math.abs(actualDate.getTime() - expectedDate.getTime());
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds

    // Verify email was sent immediately with unsubscribe text
    expect(emailClient.sendRecommendationsEmail).toHaveBeenCalledWith({
      from: 'Shelfie <postmaster@mailgun.shelfie.georgesheppard.dev>',
      to: [testEmail],
      subject: 'Your Shelfie recommendations are here!',
      template: 'recommendations',
      variables: {
        recommendationsurl: `https://shelfie.georgesheppard.dev/recommendations/${recommendation.id}`,
        unsubscribeUrl: `https://shelfie.georgesheppard.dev/unsubscribe/${request.id}`,
        unsubscribeText: 'Unsubscribe',
      },
    });
  });

  // Success tests - recommendations not done, with recurring
  test('should store email and set recurring when recommendations are not done and recurring is true', async ({ dbClient, queueClient }) => {
    const testEmail = 'newrecurring@example.com';

    // Create a request without email
    const [request] = await dbClient.db.insert(requests).values({}).returning();

    // Create a recommendation without processed data
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
        processedUtc: null,
        recommendations: null,
      })
      .returning();

    const beforeRequest = Date.now();

    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}&email=${testEmail}&recurring=true`,
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });

    // Verify email was stored (encrypted) and recurring fields set
    const [updatedRequest] = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, request.id));

    expect(updatedRequest.email).toBeTruthy();
    const decryptedEmail = encryption.decrypt(updatedRequest.email!);
    expect(decryptedEmail).toBe(testEmail);
    expect(updatedRequest.frequency).toBe('M');
    expect(updatedRequest.nextRecommendationUtc).toBeTruthy();

    // Verify nextRecommendationUtc is approximately 1 month in the future
    const expectedDate = new Date(beforeRequest + 30 * 24 * 60 * 60 * 1000);
    const actualDate = updatedRequest.nextRecommendationUtc!;
    const timeDiff = Math.abs(actualDate.getTime() - expectedDate.getTime());
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds

    // Verify email was NOT sent (recommendations not done yet)
    expect(emailClient.sendRecommendationsEmail).not.toHaveBeenCalled();
  });

  // Response shape tests
  test('should return correct response shape and headers', async ({ dbClient, queueClient }) => {
    const testEmail = 'test@example.com';

    // Create a request
    const [request] = await dbClient.db.insert(requests).values({}).returning();

    // Create a recommendation
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
      })
      .returning();

    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}&email=${testEmail}`,
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = (await response.json()) as { success: boolean };
    expect(body).toStrictEqual({ success: true });
    expect(typeof body).toBe('object');
    expect(body).toHaveProperty('success');
    expect(body.success).toBe(true);
  });

  // Test encryption/decryption flow
  test('should properly encrypt and decrypt email from request', async ({ dbClient, queueClient }) => {
    const originalEmail = 'encrypted@example.com';
    const encryptedEmail = encryption.encrypt(originalEmail);

    // Create a request with encrypted email
    const [request] = await dbClient.db
      .insert(requests)
      .values({
        email: encryptedEmail,
      })
      .returning();

    // Create a recommendation
    const [recommendation] = await dbClient.db
      .insert(recommendations)
      .values({
        requestId: request.id,
      })
      .returning();

    // Call endpoint without providing email - should use encrypted email from request
    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=${recommendation.id}`,
      })
    );

    expect(response.status).toBe(200);

    // Verify the email was decrypted and re-encrypted properly
    const [updatedRequest] = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, request.id));

    expect(updatedRequest.email).toBeTruthy();
    const decryptedEmail = encryption.decrypt(updatedRequest.email!);
    expect(decryptedEmail).toBe(originalEmail);
  });
});
