import { describe, it, expect, vi, beforeEach } from 'vitest';
import { putOpenAIKey } from './put-openai-key.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/dynamodb/utilities.js');
import { putOpenAIKeyForUser } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('putOpenAIKey handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(putOpenAIKeyForUser).mockResolvedValue(undefined);
  });

  it('should return success: true after storing the key', async () => {
    const result = await putOpenAIKey(mockContext(), { apiKey: 'sk-test-key' });

    expect(result).toEqual({ success: true });
  });

  it('should pass userId, client, and apiKey to utility function', async () => {
    const mockClient = { client: { put: vi.fn() } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });

    await putOpenAIKey(c, { apiKey: 'sk-my-key' });

    expect(putOpenAIKeyForUser).toHaveBeenCalledWith(mockClient.client, validUserId, 'sk-my-key');
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(putOpenAIKeyForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(putOpenAIKey(mockContext(), { apiKey: 'sk-test' })).rejects.toThrow(
      'DynamoDB error'
    );
  });
});
