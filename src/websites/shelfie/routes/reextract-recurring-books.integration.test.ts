import { test, describe, expect } from '@test/fixtures.js';
import { config } from '@config/index.js';
import { vi } from 'vitest';
import { requests, images } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { App } from '../../../server.js';
import { createTestApp } from '@test/utils/app.js';
import type { OpenAIClientWrapper } from '@core/utils/openai-client.js';
import type OpenAI from 'openai';

function createMockOpenAIClient(): OpenAIClientWrapper {
  return {
    getClient: () =>
      ({
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      books: [{ title: 'Dune', author: 'Frank Herbert' }],
                    }),
                  },
                },
              ],
            }),
          },
        },
      }) as unknown as OpenAI,
  } as OpenAIClientWrapper;
}

describe('GET /api/reextract-recurring-books', () => {
  let app: App;

  test.beforeEach(async ({ dbClient, queueClient }) => {
    app = await createTestApp({
      databaseClient: dbClient,
      queueClient: queueClient,
      openaiClient: createMockOpenAIClient(),
    });
  });

  test.afterEach(async ({ dbClient }) => {
    await dbClient.db.delete(images);
    await dbClient.db.delete(requests);
    vi.clearAllMocks();
  });

  test('should return 401 without api key', async () => {
    const response = await app.request(
      new Request('http://localhost/api/reextract-recurring-books', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
  });

  test('should return 401 with wrong api key', async () => {
    const response = await app.request(
      new Request('http://localhost/api/reextract-recurring-books', {
        method: 'GET',
        headers: {
          'x-api-key': 'wrong-key',
        },
      })
    );

    expect(response.status).toBe(401);
  });

  test('should return 200 with empty summary when there are no recurring users', async () => {
    const response = await app.request(
      new Request('http://localhost/api/reextract-recurring-books', {
        method: 'GET',
        headers: {
          'x-api-key': config.API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      totalUsers: 0,
      processedUsers: 0,
      skippedUsers: 0,
      failures: 0,
    });
  });

  test('should re-extract books for a recurring user with images', async ({ dbClient }) => {
    const [request] = await dbClient.db
      .insert(requests)
      .values({
        frequency: 'M',
      })
      .returning();

    await dbClient.db.insert(images).values({
      requestId: request.id,
      image: Buffer.from('fake-image-data'),
      contentType: 'image/jpeg',
    });

    const response = await app.request(
      new Request('http://localhost/api/reextract-recurring-books', {
        method: 'GET',
        headers: {
          'x-api-key': config.API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      totalUsers: 1,
      processedUsers: 1,
      skippedUsers: 0,
      failures: 0,
    });

    const [updatedRequest] = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, request.id));

    expect(updatedRequest.booksProcessed).toEqual({
      books: [{ title: 'Dune', author: 'Frank Herbert' }],
    });
    expect(updatedRequest.booksProcessedUtc).toBeInstanceOf(Date);
  });

  test('should skip a recurring user with no stored images', async ({ dbClient }) => {
    await dbClient.db.insert(requests).values({
      frequency: 'M',
    });

    const response = await app.request(
      new Request('http://localhost/api/reextract-recurring-books', {
        method: 'GET',
        headers: {
          'x-api-key': config.API_KEY,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      totalUsers: 1,
      processedUsers: 0,
      skippedUsers: 1,
      failures: 0,
    });
  });
});
