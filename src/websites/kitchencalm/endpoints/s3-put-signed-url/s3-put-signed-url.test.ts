import { describe, it, expect, vi, beforeEach } from 'vitest';
import { putSignedUrl } from './s3-put-signed-url.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/s3/utilities.js');
import { getSignedPutUrl } from '@core/s3/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    s3Client: { client: {} },
  });
}

describe('putSignedUrl handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return signed URL and constructed key', async () => {
    vi.mocked(getSignedPutUrl).mockResolvedValue('https://s3.example.com/signed-put-url');

    const result = await putSignedUrl(mockContext(), 'photo.jpg', 'image/jpeg');

    expect(result).toEqual({
      signedUrl: 'https://s3.example.com/signed-put-url',
      key: `${validUserId}/photo.jpg`,
    });
  });

  it('should construct key from userId and fileName', async () => {
    vi.mocked(getSignedPutUrl).mockResolvedValue('https://url');

    const result = await putSignedUrl(mockContext(), 'recipe-image.png', 'image/png');

    expect(result.key).toBe(`${validUserId}/recipe-image.png`);
  });

  it('should pass s3Client.client, userId, fileName, and contentType to utility function', async () => {
    const mockClient = { client: { send: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      s3Client: mockClient,
    });
    vi.mocked(getSignedPutUrl).mockResolvedValue('https://url');

    await putSignedUrl(c, 'photo.jpg', 'image/jpeg');

    expect(getSignedPutUrl).toHaveBeenCalledWith(
      mockClient.client,
      validUserId,
      'photo.jpg',
      'image/jpeg'
    );
  });

  it('should throw when S3 fails', async () => {
    vi.mocked(getSignedPutUrl).mockRejectedValue(new Error('S3 error'));

    await expect(putSignedUrl(mockContext(), 'file.jpg', 'image/jpeg')).rejects.toThrow('S3 error');
  });
});
