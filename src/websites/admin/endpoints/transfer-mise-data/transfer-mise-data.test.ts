import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext } from '@test/utils/mock-context.js';
import type { IRecipe } from '@core/types/recipes.js';
import { rewriteImageKey, transferMiseData } from './transfer-mise-data.js';

vi.mock('@core/dynamodb/utilities.js');
vi.mock('@core/s3/utilities.js');
import {
  getAllRecipesForUser,
  getMealPlanForUser,
  putMealPlanForUser,
  updateRecipe,
} from '@core/dynamodb/utilities.js';
import { copyS3Object } from '@core/s3/utilities.js';

const fromUserId = '11111111-1111-4111-8111-111111111111';
const toUserId = '22222222-2222-4222-8222-222222222222';
const recipeA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const recipeB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const recipeC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const componentA = 'aaaaaaaa-0000-4000-8000-000000000001';
const componentC = 'cccccccc-0000-4000-8000-000000000001';

function recipe(uuid: string, images: IRecipe['images'] = []): IRecipe {
  return { uuid, name: uuid, description: '', images, components: [] };
}

const dynamo = { client: { name: 'dynamo' } };
const s3 = { client: { name: 's3' } };

function mockContext() {
  return createMockContext({
    dynamoClient: dynamo,
    s3Client: s3,
  });
}

describe('transferMiseData handler', () => {
  let sourceRecipes: IRecipe[];
  let targetRecipes: IRecipe[];

  beforeEach(() => {
    vi.resetAllMocks();
    sourceRecipes = [
      recipe(recipeA, [{ key: `${fromUserId}/photo.jpg`, timestamp: 5 }]),
      recipe(recipeB),
    ];
    targetRecipes = [];
    vi.mocked(getAllRecipesForUser).mockImplementation(async (_client, userId) =>
      userId === fromUserId ? sourceRecipes : targetRecipes
    );
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);
  });

  it('rejects transferring a user to themselves', async () => {
    const result = await transferMiseData(mockContext(), {
      fromUserId,
      toUserId: fromUserId,
      includeMealPlan: false,
    });

    expect(result.status).toBe(400);
    expect(updateRecipe).not.toHaveBeenCalled();
  });

  it('copies every recipe and rewrites image keys to the target user', async () => {
    const result = await transferMiseData(mockContext(), {
      fromUserId,
      toUserId,
      includeMealPlan: false,
    });

    expect(result).toEqual({
      status: 200,
      body: { recipesCopied: 2, imagesCopied: 1, mealPlanCopied: false, skippedRecipes: [] },
    });
    expect(copyS3Object).toHaveBeenCalledWith(
      s3.client,
      `${fromUserId}/photo.jpg`,
      `${toUserId}/photo.jpg`
    );
    expect(updateRecipe).toHaveBeenCalledWith(dynamo.client, toUserId, {
      ...recipe(recipeA),
      images: [{ key: `${toUserId}/photo.jpg`, timestamp: 5 }],
    });
    expect(updateRecipe).toHaveBeenCalledWith(dynamo.client, toUserId, recipe(recipeB));
    expect(putMealPlanForUser).not.toHaveBeenCalled();
  });

  it('copies only the selected recipes', async () => {
    const result = await transferMiseData(mockContext(), {
      fromUserId,
      toUserId,
      recipeUuids: [recipeB],
      includeMealPlan: false,
    });

    expect(result).toEqual({
      status: 200,
      body: { recipesCopied: 1, imagesCopied: 0, mealPlanCopied: false, skippedRecipes: [] },
    });
    expect(updateRecipe).toHaveBeenCalledTimes(1);
    expect(copyS3Object).not.toHaveBeenCalled();
  });

  it('responds 404 without writing anything when a selected recipe does not exist', async () => {
    const missing = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    const result = await transferMiseData(mockContext(), {
      fromUserId,
      toUserId,
      recipeUuids: [recipeA, missing],
      includeMealPlan: false,
    });

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: expect.stringContaining(missing) });
    expect(updateRecipe).not.toHaveBeenCalled();
    expect(copyS3Object).not.toHaveBeenCalled();
  });

  it('does not write a recipe whose image copy failed', async () => {
    vi.mocked(copyS3Object).mockRejectedValue(new Error('S3 error'));

    await expect(
      transferMiseData(mockContext(), {
        fromUserId,
        toUserId,
        recipeUuids: [recipeA],
        includeMealPlan: false,
      })
    ).rejects.toThrow('S3 error');
    expect(updateRecipe).not.toHaveBeenCalled();
  });

  it('replaces the target meal plan, keeping only copied recipes', async () => {
    vi.mocked(getMealPlanForUser).mockResolvedValue([
      {
        date: 1,
        plan: [
          { recipeId: recipeA, components: [] },
          { recipeId: recipeB, components: [] },
        ],
      },
    ]);

    const result = await transferMiseData(mockContext(), {
      fromUserId,
      toUserId,
      recipeUuids: [recipeA],
      includeMealPlan: true,
    });

    expect(result.body).toEqual({
      recipesCopied: 1,
      imagesCopied: 1,
      mealPlanCopied: true,
      skippedRecipes: [],
    });
    expect(getMealPlanForUser).toHaveBeenCalledWith(dynamo.client, fromUserId);
    expect(putMealPlanForUser).toHaveBeenCalledWith(dynamo.client, toUserId, [
      { date: 1, plan: [{ recipeId: recipeA, components: [] }] },
    ]);
  });
  it('skips recipes the target already has by name, ignoring case and spacing', async () => {
    sourceRecipes = [{ ...recipe(recipeA), name: ' Chicken  Curry ' }, recipe(recipeB)];
    targetRecipes = [{ ...recipe(recipeC), name: 'chicken curry' }];

    const result = await transferMiseData(mockContext(), {
      fromUserId,
      toUserId,
      includeMealPlan: false,
    });

    expect(result).toEqual({
      status: 200,
      body: {
        recipesCopied: 1,
        imagesCopied: 0,
        mealPlanCopied: false,
        skippedRecipes: ['chicken curry'],
      },
    });
    expect(updateRecipe).toHaveBeenCalledTimes(1);
    expect(updateRecipe).toHaveBeenCalledWith(dynamo.client, toUserId, recipe(recipeB));
  });

  it('copies only one of several same-named source recipes', async () => {
    sourceRecipes = [recipe(recipeA), { ...recipe(recipeB), name: recipeA }];

    const result = await transferMiseData(mockContext(), {
      fromUserId,
      toUserId,
      includeMealPlan: false,
    });

    expect(result.body).toMatchObject({ recipesCopied: 1, skippedRecipes: [recipeA] });
    expect(updateRecipe).toHaveBeenCalledTimes(1);
  });

  it("points meal plan entries for skipped recipes at the target's recipe", async () => {
    const component = (uuid: string) => ({
      uuid,
      name: 'Sauce',
      ingredients: [],
      instructions: [],
    });
    sourceRecipes = [{ ...recipe(recipeA), name: 'Curry', components: [component(componentA)] }];
    targetRecipes = [{ ...recipe(recipeC), name: 'curry', components: [component(componentC)] }];
    vi.mocked(getMealPlanForUser).mockResolvedValue([
      {
        date: 1,
        plan: [{ recipeId: recipeA, components: [{ componentId: componentA, servings: 2 }] }],
      },
    ]);

    await transferMiseData(mockContext(), { fromUserId, toUserId, includeMealPlan: true });

    expect(updateRecipe).not.toHaveBeenCalled();
    expect(putMealPlanForUser).toHaveBeenCalledWith(dynamo.client, toUserId, [
      {
        date: 1,
        plan: [{ recipeId: recipeC, components: [{ componentId: componentC, servings: 2 }] }],
      },
    ]);
  });
});

describe('rewriteImageKey', () => {
  it('swaps the source user prefix for the target user', () => {
    expect(rewriteImageKey('from/dir/a.jpg', 'from', 'to')).toBe('to/dir/a.jpg');
  });

  it('prefixes keys that were not under the source user', () => {
    expect(rewriteImageKey('legacy.jpg', 'from', 'to')).toBe('to/legacy.jpg');
  });
});
