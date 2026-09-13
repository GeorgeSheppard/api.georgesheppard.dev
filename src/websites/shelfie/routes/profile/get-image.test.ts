import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getImage } from './get-image.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');
import { findImageById } from '../../queries/recommendations.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

describe('getImage handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 when image does not exist', async () => {
    vi.mocked(findImageById).mockResolvedValue(null);

    const result = await getImage(mockContext(), 1);

    expect(result).toEqual({ status: 404, body: { error: 'Image not found' } });
  });

  it('should return the image bytes and content type', async () => {
    const buffer = Buffer.from('fake-image-bytes');
    vi.mocked(findImageById).mockResolvedValue({
      id: 1,
      requestId: 'request-id',
      image: buffer,
      contentType: 'image/png',
    });

    const result = await getImage(mockContext(), 1);

    expect(result).toEqual({ status: 200, body: buffer, contentType: 'image/png' });
  });
});
