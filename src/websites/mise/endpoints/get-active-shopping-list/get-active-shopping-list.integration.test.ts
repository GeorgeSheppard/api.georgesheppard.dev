import { describe, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';

describe('Get Active Shopping List Endpoint', () => {
  test('should return an empty list with null generatedAt when none exists', async ({
    dynamoClient,
  }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);

    const response = await app.request(
      new Request('http://localhost/mise/shopping-list/active', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toEqual({ items: [], generatedAt: null });
  });

  test('should return 401 without a valid token', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/mise/shopping-list/active', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
  });
});
