import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isChatAvailable } from './is-chat-available.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('../../queries/chat-api-keys.js');
import { getChatApiKey } from '../../queries/chat-api-keys.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    databaseClient: { db: {} },
  });
}

describe('isChatAvailable handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return available: false with reason when no API key stored', async () => {
    vi.mocked(getChatApiKey).mockResolvedValue(null);

    const result = await isChatAvailable(mockContext());

    expect(result.available).toBe(false);
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  it('should return available: true when API key is stored', async () => {
    vi.mocked(getChatApiKey).mockResolvedValue('sk-test-key');

    const result = await isChatAvailable(mockContext());

    expect(result).toEqual({ available: true });
  });

  it('should not expose the API key in the response', async () => {
    vi.mocked(getChatApiKey).mockResolvedValue('sk-secret-key');

    const result = await isChatAvailable(mockContext());

    expect(JSON.stringify(result)).not.toContain('sk-secret-key');
  });

  it('should pass userId and db to query function', async () => {
    const mockDb = {};
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      databaseClient: { db: mockDb },
    });
    vi.mocked(getChatApiKey).mockResolvedValue(null);

    await isChatAvailable(c);

    expect(getChatApiKey).toHaveBeenCalledWith(mockDb, validUserId);
  });

  it('should throw when database fails', async () => {
    vi.mocked(getChatApiKey).mockRejectedValue(new Error('DB error'));

    await expect(isChatAvailable(mockContext())).rejects.toThrow('DB error');
  });
});
