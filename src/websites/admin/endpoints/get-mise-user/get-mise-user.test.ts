import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext } from '@test/utils/mock-context.js';
import type { AdminContext } from '@core/types/context.js';
import type { IRecipe } from '@core/types/recipes.js';
import { getMiseUser } from './get-mise-user.js';

vi.mock('@core/dynamodb/utilities.js');
vi.mock('@core/s3/utilities.js');
import { getAllRecipesForUser, getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { getSignedGetUrl } from '@core/s3/utilities.js';

const userId = '550e8400-e29b-41d4-a716-446655440000';

function recipe(uuid: string, name: string, images: IRecipe['images'] = []): IRecipe {
  return { uuid, name, description: '', images, components: [] };
}

function mockContext() {
  return createMockContext<AdminContext>({
    dynamoClient: { client: {} },
    s3Client: { client: {} },
  });
}

describe('getMiseUser handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);
    vi.mocked(getSignedGetUrl).mockResolvedValue('https://signed.example.com/image');
  });

  it('returns recipes sorted by name and the meal plan sorted by date', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe('2', 'Pizza'), recipe('1', 'Pasta')]);
    vi.mocked(getMealPlanForUser).mockResolvedValue([
      { date: 2, plan: [] },
      { date: 1, plan: [] },
    ]);

    const result = await getMiseUser(mockContext(), userId);

    expect(result.userId).toBe(userId);
    expect(result.recipes.map((r) => r.name)).toEqual(['Pasta', 'Pizza']);
    expect(result.mealPlan.map((d) => d.date)).toEqual([1, 2]);
    expect(getAllRecipesForUser).toHaveBeenCalledWith({}, userId);
    expect(getMealPlanForUser).toHaveBeenCalledWith({}, userId);
  });

  it('adds presigned URLs to images', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([
      recipe('1', 'Pasta', [{ key: `${userId}/a.jpg`, timestamp: 1 }]),
    ]);

    const result = await getMiseUser(mockContext(), userId);

    expect(result.recipes[0].images[0].presignedUrl).toBe('https://signed.example.com/image');
    expect(getSignedGetUrl).toHaveBeenCalledWith({}, `${userId}/a.jpg`);
  });

  it('leaves the URL undefined when signing fails', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([
      recipe('1', 'Pasta', [{ key: `${userId}/a.jpg`, timestamp: 1 }]),
    ]);
    vi.mocked(getSignedGetUrl).mockRejectedValue(new Error('S3 error'));

    const result = await getMiseUser(mockContext(), userId);

    expect(result.recipes[0].images[0].presignedUrl).toBeUndefined();
  });

  it('propagates DynamoDB failures', async () => {
    vi.mocked(getAllRecipesForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(getMiseUser(mockContext(), userId)).rejects.toThrow('DynamoDB error');
  });
});
