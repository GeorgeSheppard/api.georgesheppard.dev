/**
 * Integration tests for GET /kitchencalm/recipes endpoint
 */
import { describe, expect, vi } from 'vitest';
import { test } from '@test/fixtures.js';
import { config } from '@config/index.js';
import { signJwt } from '@core/utils/jwt.js';
import { createTestApp } from '@test/utils/app.js';
import { IRecipe, Unit } from '@core/types/recipes.js';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const anotherUserId = '550e8400-e29b-41d4-a716-446655440001';

describe('GET /kitchencalm/recipes', () => {
  test('should return empty object when user has no recipes', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({});
  });

  test('should return recipes for authenticated user', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    // Seed test data
    const testRecipe: IRecipe = {
      uuid: '550e8400-e29b-41d4-a716-446655440100' as any,
      name: 'Test Recipe',
      description: 'A test recipe',
      images: [],
      components: [
        {
          uuid: '550e8400-e29b-41d4-a716-446655440101' as any,
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
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, IRecipe>;
    expect(body).toHaveProperty('550e8400-e29b-41d4-a716-446655440100');
    expect(body['550e8400-e29b-41d4-a716-446655440100'].name).toBe('Test Recipe');
  });

  test('should return 401 when JWT is missing', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes', {
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
      new Request('http://localhost/kitchencalm/recipes', {
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

  test('should only return recipes for the authenticated user', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const user1Token = await signJwt(validUserId);

    // Seed recipes for two different users
    const recipe1: IRecipe = {
      uuid: '550e8400-e29b-41d4-a716-446655440102' as any,
      name: 'User 1 Recipe',
      description: 'Recipe for user 1',
      images: [],
      components: [],
    };

    const recipe2: IRecipe = {
      uuid: '550e8400-e29b-41d4-a716-446655440103' as any,
      name: 'User 2 Recipe',
      description: 'Recipe for user 2',
      images: [],
      components: [],
    };

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: { ...recipe1, UserId: validUserId, Item: `R-${recipe1.uuid}` },
      })
    );

    await dynamoClient.client.send(
      new PutCommand({
        TableName: config.DYNAMODB_TABLE_NAME,
        Item: { ...recipe2, UserId: anotherUserId, Item: `R-${recipe2.uuid}` },
      })
    );

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${user1Token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, IRecipe>;
    expect(body).toHaveProperty('550e8400-e29b-41d4-a716-446655440102');
    expect(body).not.toHaveProperty('550e8400-e29b-41d4-a716-446655440103');
  });

  test('should return 401 when Authorization header is malformed', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'GET',
        headers: {
          Authorization: 'NotBearer token',
        },
      })
    );

    expect(response.status).toBe(401);
  });

  test('should handle multiple recipes correctly', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const token = await signJwt(validUserId);

    // Seed multiple recipes
    const recipe1: IRecipe = {
      uuid: '550e8400-e29b-41d4-a716-446655440104' as any,
      name: 'Pasta Carbonara',
      description: 'Classic Italian pasta',
      images: [],
      components: [],
    };

    const recipe2: IRecipe = {
      uuid: '550e8400-e29b-41d4-a716-446655440105' as any,
      name: 'Margherita Pizza',
      description: 'Classic Italian pizza',
      images: [],
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
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, IRecipe>;
    expect(body).toHaveProperty('550e8400-e29b-41d4-a716-446655440104');
    expect(body).toHaveProperty('550e8400-e29b-41d4-a716-446655440105');
  });

  test('should gracefully handle missing presigned URLs', async ({ dynamoClient }) => {
    const mockS3Client = {
      client: {
        send: vi.fn().mockResolvedValue({}),
      },
      close: vi.fn().mockResolvedValue(undefined),
    } as any;
    const app = await createTestApp({ dynamoClient, s3Client: mockS3Client });
    const token = await signJwt(validUserId);

    // Seed a recipe with images
    const testRecipe: IRecipe = {
      uuid: '550e8400-e29b-41d4-a716-446655440106' as any,
      name: 'Test Recipe with Images',
      description: 'Recipe with images',
      images: [{ timestamp: 1234567890, key: `${validUserId}/image1.jpg` }],
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
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, IRecipe>;
    const recipe = body['550e8400-e29b-41d4-a716-446655440106'];
    // presignedUrl can be either present or undefined - we're testing graceful degradation
    expect(recipe.images[0]).toHaveProperty('key');
  });
});
