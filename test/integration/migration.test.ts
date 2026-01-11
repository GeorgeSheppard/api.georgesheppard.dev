import { describe, it, expect } from 'vitest';
import { createDatabaseClient } from '../../src/core/database/client.js';
import { requests, images, recommendations } from '../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm'
import { config } from "@config/index.js";

describe('Database Migrations', () => {
  it('should run migrations successfully on test container', async () => {
    const databaseClient = await createDatabaseClient(config.DATABASE_URL);

    // Verify tables exist by querying the database
    const requestsResult = await databaseClient.db.select().from(requests).limit(1);
    expect(Array.isArray(requestsResult)).toBe(true);

    const imagesResult = await databaseClient.db.select().from(images).limit(1);
    expect(Array.isArray(imagesResult)).toBe(true);

    const recommendationsResult = await databaseClient.db.select().from(recommendations).limit(1);
    expect(Array.isArray(recommendationsResult)).toBe(true);

    await databaseClient.close();
  });

  it('should allow inserting and querying data after migration', async () => {
    const databaseClient = await createDatabaseClient(config.DATABASE_URL);

    // Insert test data
    const newRequest = await databaseClient.db.insert(requests).values({
      email: 'test@example.com',
      location: 'US',
    }).returning();

    expect(newRequest).toHaveLength(1);
    expect(newRequest[0].email).toBe('test@example.com');
    expect(newRequest[0].id).toBeDefined();

    // Query the inserted data
    const queriedRequest = await databaseClient.db
      .select()
      .from(requests)
      .where(eq(requests.email, 'test@example.com'));

    expect(queriedRequest).toHaveLength(1);
    expect(queriedRequest[0].email).toBe('test@example.com');

    await databaseClient.close();
  });
});
