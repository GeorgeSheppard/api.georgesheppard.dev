import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext } from '@test/utils/mock-context.js';
import type { AdminContext } from '@core/types/context.js';
import { listMiseUsers } from './list-mise-users.js';

vi.mock('@core/dynamodb/utilities.js');
import { scanAllItemKeys } from '@core/dynamodb/utilities.js';

function mockContext() {
  return createMockContext<AdminContext>({ dynamoClient: { client: {} } });
}

describe('listMiseUsers handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty list when the table is empty', async () => {
    vi.mocked(scanAllItemKeys).mockResolvedValue([]);

    expect(await listMiseUsers(mockContext())).toEqual({ users: [] });
  });

  it('summarises recipes and meal plans per user, most recipes first', async () => {
    vi.mocked(scanAllItemKeys).mockResolvedValue([
      { userId: 'user-a', item: 'R-1' },
      { userId: 'user-b', item: 'MP' },
      { userId: 'user-b', item: 'R-2' },
      { userId: 'user-b', item: 'R-3' },
      { userId: 'user-c', item: 'MP' },
    ]);

    expect(await listMiseUsers(mockContext())).toEqual({
      users: [
        { userId: 'user-b', recipeCount: 2, hasMealPlan: true },
        { userId: 'user-a', recipeCount: 1, hasMealPlan: false },
        { userId: 'user-c', recipeCount: 0, hasMealPlan: true },
      ],
    });
  });

  it('ignores unknown item types but still lists the user', async () => {
    vi.mocked(scanAllItemKeys).mockResolvedValue([{ userId: 'user-a', item: 'SOMETHING' }]);

    expect(await listMiseUsers(mockContext())).toEqual({
      users: [{ userId: 'user-a', recipeCount: 0, hasMealPlan: false }],
    });
  });
});
