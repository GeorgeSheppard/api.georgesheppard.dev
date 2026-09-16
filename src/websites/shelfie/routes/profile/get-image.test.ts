import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getImage } from './get-image.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');
vi.mock('@core/utils/image-thumbnail.js');

import { findImageByIdForRequest } from '../../queries/recommendations.js';
import { createThumbnail } from '@core/utils/image-thumbnail.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

describe('getImage handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 when the image does not belong to the request', async () => {
    vi.mocked(findImageByIdForRequest).mockResolvedValue(null);

    const result = await getImage(mockContext(), 'request-id', 1, false);

    expect(findImageByIdForRequest).toHaveBeenCalledWith({}, 1, 'request-id');
    expect(result).toEqual({ status: 404, body: { error: 'Image not found' } });
  });

  it('should return the full-resolution image bytes and content type by default', async () => {
    const buffer = Buffer.from('fake-image-bytes');
    vi.mocked(findImageByIdForRequest).mockResolvedValue({
      id: 1,
      requestId: 'request-id',
      image: buffer,
      contentType: 'image/png',
    });

    const result = await getImage(mockContext(), 'request-id', 1, false);

    expect(result).toEqual({ status: 200, body: buffer, contentType: 'image/png' });
    expect(createThumbnail).not.toHaveBeenCalled();
  });

  it('should return a resized thumbnail when requested, without touching the stored original', async () => {
    const buffer = Buffer.from('fake-image-bytes');
    vi.mocked(findImageByIdForRequest).mockResolvedValue({
      id: 1,
      requestId: 'request-id',
      image: buffer,
      contentType: 'image/png',
    });
    const thumbnailBuffer = Buffer.from('small-jpeg-bytes');
    vi.mocked(createThumbnail).mockResolvedValue({
      buffer: thumbnailBuffer,
      contentType: 'image/jpeg',
    });

    const result = await getImage(mockContext(), 'request-id', 1, true);

    expect(createThumbnail).toHaveBeenCalledWith(buffer);
    expect(result).toEqual({ status: 200, body: thumbnailBuffer, contentType: 'image/jpeg' });
  });
});
