import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getImage } from './get-image.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');
import { findImageByIdForRequest } from '../../queries/recommendations.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

describe('getImage handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 when the image does not belong to the request', async () => {
    vi.mocked(findImageByIdForRequest).mockResolvedValue(null);

    const result = await getImage(mockContext(), 'request-id', 1);

    expect(findImageByIdForRequest).toHaveBeenCalledWith({}, 1, 'request-id');
    expect(result).toEqual({ status: 404, body: { error: 'Image not found' } });
  });

  it('should return the image bytes and content type', async () => {
    const buffer = Buffer.from('fake-image-bytes');
    vi.mocked(findImageByIdForRequest).mockResolvedValue({
      id: 1,
      requestId: 'request-id',
      image: buffer,
      contentType: 'image/png',
    });

    const result = await getImage(mockContext(), 'request-id', 1);

    expect(result).toEqual({ status: 200, body: buffer, contentType: 'image/png' });
  });
});
