/**
 * Integration tests for GET /kitchencalm/recipes/search endpoint
 */
import { describe, expect } from 'vitest';
import { test } from '@test/fixtures.js';
import { config } from '@config/index.js';
import { signJwt } from '@core/utils/jwt.js';
import { createTestApp } from '@test/utils/app.js';
import { IRecipe, Unit } from '@core/types/recipes.js';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const anotherUserId = '550e8400-e29b-41d4-a716-446655440001';

// Generate unique UUIDs for each test to ensure isolation
function generateUUID(index: number): string {
  return `550e8400-e29b-41d4-a716-${String(446655440000 + index).padStart(12, '0')}`;
}

describe('GET /kitchencalm/recipes/search', () => {
  test('should return empty results when user has no recipes', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=pasta', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ results: [], count: 0 });
  });

  test('should return empty results when search matches nothing', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const testRecipe: IRecipe = {
      uuid: generateUUID(100) as any,
      name: 'Test Recipe',
      description: 'A test recipe',
      components: [
        {
          uuid: generateUUID(101) as any,
          name: 'Main',
          ingredients: [{ name: 'Flour', quantity: { unit: Unit.CUP, value: 2 } }],
          instructions: [{ text: 'Mix ingredients' }],
        },
      ],
    };

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: {
          ...testRecipe,
          UserId: validUserId,
          Item: `R-${testRecipe.uuid}`,
        },
      })
    );

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=nonexistent', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ results: [], count: 0 });
  });

  test('should search by recipe name', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const testRecipe: IRecipe = {
      uuid: generateUUID(102) as any,
      name: 'Pasta Carbonara',
      description: 'Classic Italian pasta dish',
      components: [
        {
          uuid: '550e8400-e29b-41d4-a716-446655440103' as any,
          name: 'Main',
          ingredients: [{ name: 'Spaghetti', quantity: { unit: Unit.GRAM, value: 400 } }],
          instructions: [{ text: 'Boil water and cook pasta' }],
        },
      ],
    };

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: {
          ...testRecipe,
          UserId: validUserId,
          Item: `R-${testRecipe.uuid}`,
        },
      })
    );

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=Pasta', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; results: any[] };
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.results.find((r) => r.name === 'Pasta Carbonara')).toBeDefined();
  });

  test('should search by ingredient name', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const testRecipe: IRecipe = {
      uuid: generateUUID(105) as any,
      name: 'Carbonara',
      description: 'Italian pasta',
      components: [
        {
          uuid: generateUUID(106) as any,
          name: 'Main',
          ingredients: [
            { name: 'Spaghetti', quantity: { unit: Unit.GRAM, value: 400 } },
            { name: 'Bacon', quantity: { unit: Unit.GRAM, value: 200 } },
            { name: 'Parmesan', quantity: { unit: Unit.GRAM, value: 100 } },
          ],
          instructions: [{ text: 'Mix and cook' }],
        },
      ],
    };

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: {
          ...testRecipe,
          UserId: validUserId,
          Item: `R-${testRecipe.uuid}`,
        },
      })
    );

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=Bacon', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; results: any[] };
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.results.some((r) => r.ingredients.includes('Bacon'))).toBe(true);
  });

  test('should search by description', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const testRecipe: IRecipe = {
      uuid: generateUUID(107) as any,
      name: 'Simple Pasta',
      description: 'A delicious vegetarian pasta dish',
      components: [],
    };

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: {
          ...testRecipe,
          UserId: validUserId,
          Item: `R-${testRecipe.uuid}`,
        },
      })
    );

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=vegetarian', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; results: any[] };
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.results.some((r) => r.description.includes('vegetarian'))).toBe(true);
  });

  test('should search by instruction text', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const testRecipe: IRecipe = {
      uuid: generateUUID(108) as any,
      name: 'Baked Salmon',
      description: 'Fresh salmon recipe',
      components: [
        {
          uuid: generateUUID(109) as any,
          name: 'Main',
          ingredients: [{ name: 'Salmon', quantity: { unit: Unit.GRAM, value: 500 } }],
          instructions: [{ text: 'Preheat oven to 400 degrees and bake salmon for 15 minutes' }],
        },
      ],
    };

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: {
          ...testRecipe,
          UserId: validUserId,
          Item: `R-${testRecipe.uuid}`,
        },
      })
    );

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=Preheat', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; results: any[] };
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.results.some((r) => r.name === 'Baked Salmon')).toBe(true);
  });

  test('should support field filtering', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const testRecipe: IRecipe = {
      uuid: generateUUID(110) as any,
      name: 'Pasta Bread',
      description: 'Bread recipe',
      components: [
        {
          uuid: generateUUID(111) as any,
          name: 'Main',
          ingredients: [{ name: 'Flour', quantity: { unit: Unit.GRAM, value: 400 } }],
          instructions: [{ text: 'Mix and bake' }],
        },
      ],
    };

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: {
          ...testRecipe,
          UserId: validUserId,
          Item: `R-${testRecipe.uuid}`,
        },
      })
    );

    // Search for "Pasta" in name field only - should find it
    const responseNameOnly = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=Pasta&fields=name', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(responseNameOnly.status).toBe(200);
    const bodyNameOnly = (await responseNameOnly.json()) as { count: number; results: any[] };
    expect(bodyNameOnly.count).toBeGreaterThanOrEqual(1);
    expect(bodyNameOnly.results.some((r) => r.name === 'Pasta Bread')).toBe(true);
  });

  test('should return 401 when JWT is missing', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=pasta', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 401 when JWT is invalid', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=pasta', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should only search recipes for the authenticated user', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const user1Token = await signJwt(validUserId);

    const recipe1: IRecipe = {
      uuid: generateUUID(112) as any,
      name: 'User 1 Pasta',
      description: 'User 1 pasta recipe',
      components: [],
    };

    const recipe2: IRecipe = {
      uuid: generateUUID(113) as any,
      name: 'User 2 Pasta',
      description: 'User 2 pasta recipe',
      components: [],
    };

    await Promise.all([
      dynamoClient.client.send(
        new PutCommand({
          TableName: config.DYNAMODB_TABLE_NAME,
          Item: { ...recipe1, UserId: validUserId, Item: `R-${recipe1.uuid}` },
        })
      ),
      dynamoClient.client.send(
        new PutCommand({
          TableName: config.DYNAMODB_TABLE_NAME,
          Item: { ...recipe2, UserId: anotherUserId, Item: `R-${recipe2.uuid}` },
        })
      ),
    ]);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=Pasta', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${user1Token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; results: any[] };
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.results.some((r) => r.name === 'User 1 Pasta')).toBe(true);
    // Ensure User 2's recipe is not included
    expect(body.results.some((r) => r.name === 'User 2 Pasta')).toBe(false);
  });

  test('should return multiple search results', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const recipe1: IRecipe = {
      uuid: generateUUID(114) as any,
      name: 'Pasta Carbonara',
      description: 'Italian pasta',
      components: [],
    };

    const recipe2: IRecipe = {
      uuid: generateUUID(115) as any,
      name: 'Pasta Alfredo',
      description: 'Creamy pasta',
      components: [],
    };

    await Promise.all([
      dynamoClient.client.send(
        new PutCommand({
          TableName: config.DYNAMODB_TABLE_NAME,
          Item: { ...recipe1, UserId: validUserId, Item: `R-${recipe1.uuid}` },
        })
      ),
      dynamoClient.client.send(
        new PutCommand({
          TableName: config.DYNAMODB_TABLE_NAME,
          Item: { ...recipe2, UserId: validUserId, Item: `R-${recipe2.uuid}` },
        })
      ),
    ]);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=Pasta', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; results: any[] };
    expect(body.count).toBeGreaterThanOrEqual(2);
    const names = body.results.map((r: any) => r.name);
    expect(names).toContain('Pasta Carbonara');
    expect(names).toContain('Pasta Alfredo');
  });

  test('should return minimal response data', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const testRecipe: IRecipe = {
      uuid: generateUUID(116) as any,
      name: 'Test Recipe',
      description: 'A test recipe with images',
      image: { timestamp: Date.now(), key: 'image.jpg' },
      components: [
        {
          uuid: generateUUID(117) as any,
          name: 'Main',
          ingredients: [{ name: 'Flour', quantity: { unit: Unit.CUP, value: 2 } }],
          instructions: [{ text: 'Mix ingredients' }],
        },
      ],
    };

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: {
          ...testRecipe,
          UserId: validUserId,
          Item: `R-${testRecipe.uuid}`,
        },
      })
    );

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes/search?q=Test', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; results: any[] };

    // Verify we have results
    expect(body.count).toBeGreaterThanOrEqual(1);

    // Pick any result and verify it has minimal fields
    const result = body.results[0];

    // Should only have uuid, name, description, and ingredients
    expect(Object.keys(result).sort()).toEqual(
      ['description', 'ingredients', 'name', 'uuid'].sort()
    );
    expect(typeof result.uuid).toBe('string');
    expect(typeof result.name).toBe('string');
    expect(typeof result.description).toBe('string');
    expect(Array.isArray(result.ingredients)).toBe(true);
  });
});
