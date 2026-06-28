import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteFile } from './s3-delete.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/s3/utilities.js');
import { deleteS3Object } from '@core/s3/utilities.js';

function mockContext() {
  return createMockContext<ContextWithUserId>({
    s3Client: { client: {} },
  });
}

describe('deleteFile handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return success on delete', async () => {
    vi.mocked(deleteS3Object).mockResolvedValue();

    const result = await deleteFile(mockContext(), 'user-123/photo.jpg');

    expect(result).toEqual({ success: true });
  });

  it('should pass s3Client.client and key to utility function', async () => {
    const mockClient = { client: { send: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      s3Client: mockClient,
    });
    vi.mocked(deleteS3Object).mockResolvedValue();

    await deleteFile(c, 'some/key.png');

    expect(deleteS3Object).toHaveBeenCalledWith(mockClient.client, 'some/key.png');
  });

  it('should throw when S3 fails', async () => {
    vi.mocked(deleteS3Object).mockRejectedValue(new Error('S3 error'));

    await expect(deleteFile(mockContext(), 'key')).rejects.toThrow('S3 error');
  });
});
