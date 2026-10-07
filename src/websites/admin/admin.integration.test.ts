/**
 * Integration tests for POST /admin/mise/transfer
 */
import { describe, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { test } from '@test/fixtures.js';
import { config } from '@config/index.js';
import { createTestApp } from '@test/utils/app.js';
import { IRecipe } from '@core/types/recipes.js';
import { DynamoDBClientWrapper } from '@core/dynamodb/client.js';
import { getAllRecipesForUser, getMealPlanForUser } from '@core/dynamodb/utilities.js';

const headers = { 'x-api-key': config.API_KEY, 'Content-Type': 'application/json' };

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

describe('POST /admin/mise/transfer', () => {
  test('rejects requests without the API key', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request('http://localhost/admin/mise/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId: randomUUID(), toUserId: randomUUID() }),
    });

    expect(response.status).toBe(401);
  });

  test('rejects requests with the wrong API key', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request('http://localhost/admin/mise/transfer', {
      method: 'POST',
      headers: { ...headers, 'x-api-key': 'wrong-key' },
      body: JSON.stringify({ fromUserId: randomUUID(), toUserId: randomUUID() }),
    });

    expect(response.status).toBe(401);
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
      skippedRecipes: [],
    });
    for (const userId of [fromUserId, toUserId]) {
      expect(await getAllRecipesForUser(dynamoClient.client, userId)).toEqual([pasta]);
      expect(await getMealPlanForUser(dynamoClient.client, userId)).toEqual(mealPlan);
    }
  });

  test('does not duplicate recipes the target already has by name', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const fromUserId = randomUUID();
    const toUserId = randomUUID();
    const pasta = recipe('Pasta');
    const pizza = recipe('Pizza');
    const existingPasta = recipe('pasta');
    await seedRecipe(dynamoClient, fromUserId, pasta);
    await seedRecipe(dynamoClient, fromUserId, pizza);
    await seedRecipe(dynamoClient, toUserId, existingPasta);

    for (let run = 0; run < 2; run++) {
      const response = await app.request('http://localhost/admin/mise/transfer', {
        method: 'POST',
        headers,
        body: JSON.stringify({ fromUserId, toUserId }),
      });
      expect(response.status).toBe(200);
    }

    const targetRecipes = await getAllRecipesForUser(dynamoClient.client, toUserId);
    expect(targetRecipes).toHaveLength(2);
    expect(targetRecipes).toEqual(expect.arrayContaining([existingPasta, pizza]));
  });

  test('rejects transferring a user to themselves', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = randomUUID();

    const response = await app.request('http://localhost/admin/mise/transfer', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fromUserId: userId, toUserId: userId }),
    });

    expect(response.status).toBe(400);
  });
});
