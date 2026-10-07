/**
 * Integration tests for the /admin/mise routes
 */
import { describe, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { test } from '@test/fixtures.js';
import { config } from '@config/index.js';
import { createTestApp } from '@test/utils/app.js';
import { IRecipe } from '@core/types/recipes.js';
import { DynamoDBClientWrapper } from '@core/dynamodb/client.js';

const apiKeyHeader = { 'x-api-key': config.API_KEY };

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
  test('rejects requests without the API key', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request('http://localhost/admin/mise/users');

    expect(response.status).toBe(401);
  });

  test('rejects requests with the wrong API key', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request('http://localhost/admin/mise/users', {
      headers: { 'x-api-key': 'wrong-key' },
    });

    expect(response.status).toBe(401);
  });

  test('lists users with a summary of their data', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = randomUUID();
    await seedRecipe(dynamoClient, userId, recipe('Pasta'));
    await seedRecipe(dynamoClient, userId, recipe('Pizza'));

    const response = await app.request('http://localhost/admin/mise/users', {
      headers: apiKeyHeader,
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
      headers: apiKeyHeader,
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
      ...apiKeyHeader,
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
        ...apiKeyHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fromUserId: userId, toUserId: userId }),
    });

    expect(response.status).toBe(400);
  });
});
