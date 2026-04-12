import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOpenAIKeyStatus } from './get-openai-key-status.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/dynamodb/utilities.js');
import { getOpenAIKeyForUser } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('getOpenAIKeyStatus handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return hasKey: false when no key is stored', async () => {
    vi.mocked(getOpenAIKeyForUser).mockResolvedValue(null);

    const result = await getOpenAIKeyStatus(mockContext());

    expect(result).toEqual({ hasKey: false });
  });

  it('should return hasKey: true when a key is stored', async () => {
    vi.mocked(getOpenAIKeyForUser).mockResolvedValue('sk-test-key');

    const result = await getOpenAIKeyStatus(mockContext());

    expect(result).toEqual({ hasKey: true });
  });

  it('should pass userId and dynamoClient to utility function', async () => {
    const mockClient = { client: { get: vi.fn() } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });
    vi.mocked(getOpenAIKeyForUser).mockResolvedValue(null);

    await getOpenAIKeyStatus(c);

    expect(getOpenAIKeyForUser).toHaveBeenCalledWith(mockClient.client, validUserId);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getOpenAIKeyForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(getOpenAIKeyStatus(mockContext())).rejects.toThrow('DynamoDB error');
  });
});
