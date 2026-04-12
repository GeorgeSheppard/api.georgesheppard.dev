import { describe, it, expect, vi, beforeEach } from 'vitest';
import { putOpenAIKey } from './put-openai-key.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('../../queries/chat-api-keys.js');
import { upsertChatApiKey } from '../../queries/chat-api-keys.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    databaseClient: { db: {} },
  });
}

describe('putOpenAIKey handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(upsertChatApiKey).mockResolvedValue(undefined);
  });

  it('should return success: true after storing the key', async () => {
    const result = await putOpenAIKey(mockContext(), { apiKey: 'sk-test-key' });

    expect(result).toEqual({ success: true });
  });

  it('should pass userId, db, and apiKey to query function', async () => {
    const mockDb = {};
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      databaseClient: { db: mockDb },
    });

    await putOpenAIKey(c, { apiKey: 'sk-my-key' });

    expect(upsertChatApiKey).toHaveBeenCalledWith(mockDb, validUserId, 'sk-my-key');
  });

  it('should throw when database fails', async () => {
    vi.mocked(upsertChatApiKey).mockRejectedValue(new Error('DB error'));

    await expect(putOpenAIKey(mockContext(), { apiKey: 'sk-test' })).rejects.toThrow('DB error');
  });
});
