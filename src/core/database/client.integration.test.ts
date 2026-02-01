import { test, describe, expect } from '../../../test/fixtures.js';
import { requests, images, recommendations } from './schema/index.js';
import { eq } from 'drizzle-orm';

describe('Database Migrations', () => {
  test('should run migrations successfully on test container', async ({ dbClient }) => {
    // Verify tables exist by querying the database
    const requestsResult = await dbClient.db.select().from(requests).limit(1);
    expect(Array.isArray(requestsResult)).toBe(true);

    const imagesResult = await dbClient.db.select().from(images).limit(1);
    expect(Array.isArray(imagesResult)).toBe(true);

    const recommendationsResult = await dbClient.db.select().from(recommendations).limit(1);
    expect(Array.isArray(recommendationsResult)).toBe(true);
  });

  test('should allow inserting and querying data after migration', async ({ dbClient }) => {
    // Insert test data
    const newRequest = await dbClient.db
      .insert(requests)
      .values({
        email: 'test@example.com',
        location: 'US',
      })
      .returning();

    expect(newRequest).toHaveLength(1);
    expect(newRequest[0].email).toBe('test@example.com');
    expect(newRequest[0].id).toBeDefined();

    // Query the inserted data
    const queriedRequest = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.email, 'test@example.com'));

    expect(queriedRequest).toHaveLength(1);
    expect(queriedRequest[0].email).toBe('test@example.com');
  });
});
