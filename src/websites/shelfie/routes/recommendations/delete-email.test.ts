import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteEmail } from './delete-email.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');

import { clearRequestEmailFields } from '../../queries/recommendations.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

describe('deleteEmail handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call clearRequestEmailFields with db and requestId', async () => {
    const mockDb = { update: 'mock' };
    const c = createMockContext({ databaseClient: { db: mockDb } });

    await deleteEmail(c, 'request-123');

    expect(clearRequestEmailFields).toHaveBeenCalledWith(mockDb, 'request-123');
  });

  it('should return an empty object', async () => {
    const result = await deleteEmail(mockContext(), 'request-123');

    expect(result).toEqual({});
  });
});
