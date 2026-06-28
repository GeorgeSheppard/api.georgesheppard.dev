import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSignedUrl } from './s3-get-signed-url.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/s3/utilities.js');
import { getSignedGetUrl } from '@core/s3/utilities.js';

function mockContext() {
  return createMockContext<ContextWithUserId>({
    s3Client: { client: {} },
  });
}

describe('getSignedUrl handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return signed URL for given key', async () => {
    vi.mocked(getSignedGetUrl).mockResolvedValue('https://s3.example.com/signed-get-url');

    const result = await getSignedUrl(mockContext(), 'user-123/image.jpg');

    expect(result).toEqual({ signedUrl: 'https://s3.example.com/signed-get-url' });
  });

  it('should pass s3Client.client and key to utility function', async () => {
    const mockClient = { client: { send: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      s3Client: mockClient,
    });
    vi.mocked(getSignedGetUrl).mockResolvedValue('https://url');

    await getSignedUrl(c, 'some/key.png');

    expect(getSignedGetUrl).toHaveBeenCalledWith(mockClient.client, 'some/key.png');
  });

  it('should throw when S3 fails', async () => {
    vi.mocked(getSignedGetUrl).mockRejectedValue(new Error('S3 error'));

    await expect(getSignedUrl(mockContext(), 'key')).rejects.toThrow('S3 error');
  });
});
