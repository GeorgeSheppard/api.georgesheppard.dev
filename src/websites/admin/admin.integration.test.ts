/**
 * Integration tests for the /admin/mise routes, using real Access-style JWTs signed by a test key
 */
import { describe, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { test } from '@test/fixtures.js';
import { config } from '@config/index.js';
import { createTestApp } from '@test/utils/app.js';
import { IRecipe } from '@core/types/recipes.js';
import { DynamoDBClientWrapper } from '@core/dynamodb/client.js';
import { ADMIN_ACCESS_JWT_HEADER } from '@core/middleware/admin-auth.js';

const testKeys = vi.hoisted(async () => {
  const { createLocalJWKSet, exportJWK, generateKeyPair } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' };
  return { privateKey, getKey: createLocalJWKSet({ keys: [jwk] }) };
});

vi.mock('@core/utils/cloudflare-access.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@core/utils/cloudflare-access.js')>();
  const { getKey } = await testKeys;
  return {
    ...actual,
    verifyAccessJwt: (token: string, accessConfig: Parameters<typeof actual.verifyAccessJwt>[1]) =>
      actual.verifyAccessJwt(token, accessConfig, getKey),
  };
});

async function accessToken(email = 'admin@example.com') {
  const { SignJWT } = await import('jose');
  const { privateKey } = await testKeys;
  return new SignJWT({ type: 'app', email })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(config.CF_ACCESS_TEAM_DOMAIN!)
    .setAudience(config.CF_ACCESS_ADMIN_AUD!)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

function recipe(name: string): IRecipe {
  return {
    uuid: randomUUID(),
    name,
    description: `${name} description`,
    images: [],
    components: [],
  };
}

async function seedRecipe(dynamoClient: DynamoDBClientWrapper, userId: string, item: IRecipe) {
  await dynamoClient.client.send(
    new PutCommand({
      TableName: config.DYNAMODB_TABLE_NAME,
      Item: { ...item, UserId: userId, Item: `R-${item.uuid}` },
    })
  );
}

describe('/admin/mise', () => {
  test('rejects requests without an Access token', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request('http://localhost/admin/mise/users');

    expect(response.status).toBe(401);
  });

  test('rejects tokens for emails that are not admins', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request('http://localhost/admin/mise/users', {
      headers: { [ADMIN_ACCESS_JWT_HEADER]: await accessToken('someone@example.com') },
    });

    expect(response.status).toBe(403);
  });

  test('lists users with a summary of their data', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = randomUUID();
    await seedRecipe(dynamoClient, userId, recipe('Pasta'));
    await seedRecipe(dynamoClient, userId, recipe('Pizza'));

    const response = await app.request('http://localhost/admin/mise/users', {
      headers: { [ADMIN_ACCESS_JWT_HEADER]: await accessToken() },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { users: unknown[] };
    expect(body.users).toContainEqual({ userId, recipeCount: 2, hasMealPlan: false });
  });

  test("returns a user's recipes and meal plan", async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = randomUUID();
    const pasta = recipe('Pasta');
    await seedRecipe(dynamoClient, userId, pasta);

    const response = await app.request(`http://localhost/admin/mise/users/${userId}`, {
      headers: { [ADMIN_ACCESS_JWT_HEADER]: await accessToken() },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId, recipes: [pasta], mealPlan: [] });
  });

  test('copies recipes and the meal plan to another user', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const fromUserId = randomUUID();
    const toUserId = randomUUID();
    const pasta = recipe('Pasta');
    await seedRecipe(dynamoClient, fromUserId, pasta);
    const mealPlan = [{ date: 1, plan: [{ recipeId: pasta.uuid, components: [] }] }];
    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: { UserId: fromUserId, Item: 'MP', data: mealPlan },
      })
    );
    const headers = {
      [ADMIN_ACCESS_JWT_HEADER]: await accessToken(),
      'Content-Type': 'application/json',
    };

    const response = await app.request('http://localhost/admin/mise/transfer', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fromUserId, toUserId, includeMealPlan: true }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recipesCopied: 1,
      imagesCopied: 0,
      mealPlanCopied: true,
    });

    for (const userId of [fromUserId, toUserId]) {
      const userResponse = await app.request(`http://localhost/admin/mise/users/${userId}`, {
        headers,
      });
      expect(await userResponse.json()).toEqual({ userId, recipes: [pasta], mealPlan });
    }
  });

  test('rejects transferring a user to themselves', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = randomUUID();

    const response = await app.request('http://localhost/admin/mise/transfer', {
      method: 'POST',
      headers: {
        [ADMIN_ACCESS_JWT_HEADER]: await accessToken(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fromUserId: userId, toUserId: userId }),
    });

    expect(response.status).toBe(400);
  });
});
