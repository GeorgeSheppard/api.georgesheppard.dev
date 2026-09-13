import { test, describe, expect } from '@test/fixtures.js';
import { requests, images } from '@core/database/schema/index.js';
import { App } from '../../../../server.js';
import { createTestApp } from '@test/utils/app.js';

describe('GET /api/profile/images/:imageId/:accessToken', () => {
  let app: App;

  test.beforeEach(async ({ dbClient, queueClient }) => {
    app = await createTestApp({ databaseClient: dbClient, queueClient: queueClient });
  });

  test.afterEach(async ({ dbClient }) => {
    await dbClient.db.delete(images);
    await dbClient.db.delete(requests);
  });

  test('should return the image bytes when the access token matches', async ({ dbClient }) => {
    const [request] = await dbClient.db.insert(requests).values({}).returning();
    const [image] = await dbClient.db
      .insert(images)
      .values({
        requestId: request.id,
        image: Buffer.from('fake-image-bytes'),
        contentType: 'image/png',
      })
      .returning();

    const response = await app.request(
      new Request(`http://localhost/api/profile/images/${image.id}/${image.accessToken}`, {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.toString()).toBe('fake-image-bytes');
  });

  test('should return 404 when the access token belongs to a different image', async ({
    dbClient,
  }) => {
    const [request] = await dbClient.db.insert(requests).values({}).returning();
    const [imageA, imageB] = await dbClient.db
      .insert(images)
      .values([
        { requestId: request.id, image: Buffer.from('a'), contentType: 'image/png' },
        { requestId: request.id, image: Buffer.from('b'), contentType: 'image/png' },
      ])
      .returning();

    // imageA's id with imageB's token must not resolve to either image.
    const response = await app.request(
      new Request(`http://localhost/api/profile/images/${imageA.id}/${imageB.accessToken}`, {
        method: 'GET',
      })
    );

    expect(response.status).toBe(404);
  });

  test('should return 404 for a random, non-existent access token', async ({ dbClient }) => {
    const [request] = await dbClient.db.insert(requests).values({}).returning();
    const [image] = await dbClient.db
      .insert(images)
      .values({
        requestId: request.id,
        image: Buffer.from('fake-image-bytes'),
        contentType: 'image/png',
      })
      .returning();

    const response = await app.request(
      new Request(
        `http://localhost/api/profile/images/${image.id}/00000000-0000-0000-0000-000000000000`,
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(404);
  });

  test('should return 404 for a non-existent image id', async () => {
    const response = await app.request(
      new Request(
        'http://localhost/api/profile/images/999999/00000000-0000-0000-0000-000000000000',
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(404);
  });
});
