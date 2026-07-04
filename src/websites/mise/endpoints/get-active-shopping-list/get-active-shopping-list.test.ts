import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveShoppingList } from './get-active-shopping-list.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import { Unit } from '@core/types/recipes.js';

vi.mock('@core/dynamodb/utilities.js');

import { getShoppingListForUser } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('getActiveShoppingList handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an empty list with null generatedAt when none exists', async () => {
    vi.mocked(getShoppingListForUser).mockResolvedValue(null);

    const result = await getActiveShoppingList(mockContext());

    expect(result).toEqual({ items: [], generatedAt: null });
  });

  it('should return the stored shopping list', async () => {
    const stored = {
      items: [
        {
          ingredient: 'Spaghetti',
          quantities: [{ value: 400, unit: Unit.GRAM }],
          category: 'Rice, Pasta & Grains',
          meals: ['Pasta'],
        },
      ],
      generatedAt: 12345,
    };
    vi.mocked(getShoppingListForUser).mockResolvedValue(stored);

    const result = await getActiveShoppingList(mockContext());

    expect(result).toEqual(stored);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getShoppingListForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(getActiveShoppingList(mockContext())).rejects.toThrow('DynamoDB error');
  });
});
