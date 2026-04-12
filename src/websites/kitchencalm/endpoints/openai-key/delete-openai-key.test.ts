import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteOpenAIKey } from './delete-openai-key.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/dynamodb/utilities.js');
import { deleteOpenAIKeyForUser } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('deleteOpenAIKey handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteOpenAIKeyForUser).mockResolvedValue(undefined);
  });

  it('should return success: true after deleting the key', async () => {
    const result = await deleteOpenAIKey(mockContext());

    expect(result).toEqual({ success: true });
  });

  it('should pass userId and client to utility function', async () => {
    const mockClient = { client: { delete: vi.fn() } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });

    await deleteOpenAIKey(c);

    expect(deleteOpenAIKeyForUser).toHaveBeenCalledWith(mockClient.client, validUserId);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(deleteOpenAIKeyForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(deleteOpenAIKey(mockContext())).rejects.toThrow('DynamoDB error');
  });
});
