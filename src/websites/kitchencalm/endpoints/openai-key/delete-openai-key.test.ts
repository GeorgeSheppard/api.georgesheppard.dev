import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteOpenAIKey } from './delete-openai-key.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('../../queries/chat-api-keys.js');
import { deleteChatApiKey } from '../../queries/chat-api-keys.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    databaseClient: { db: {} },
  });
}

describe('deleteOpenAIKey handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteChatApiKey).mockResolvedValue(undefined);
  });

  it('should return success: true after deleting the key', async () => {
    const result = await deleteOpenAIKey(mockContext());

    expect(result).toEqual({ success: true });
  });

  it('should pass userId and db to query function', async () => {
    const mockDb = {};
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      databaseClient: { db: mockDb },
    });

    await deleteOpenAIKey(c);

    expect(deleteChatApiKey).toHaveBeenCalledWith(mockDb, validUserId);
  });

  it('should throw when database fails', async () => {
    vi.mocked(deleteChatApiKey).mockRejectedValue(new Error('DB error'));

    await expect(deleteOpenAIKey(mockContext())).rejects.toThrow('DB error');
  });
});
