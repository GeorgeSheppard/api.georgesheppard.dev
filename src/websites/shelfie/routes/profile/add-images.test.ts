import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addImages } from './add-images.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { UploadedFile } from '@core/utils/multipart.js';

vi.mock('../../queries/recommendations.js');
vi.mock('../../utils/image-extraction.js');

import { addImagesToRequest } from '../../queries/recommendations.js';
import { extractAndStoreBooksPerImage } from '../../utils/image-extraction.js';

function mockContext() {
  return createMockContext({
    databaseClient: { db: {} },
    openaiClient: { getClient: () => ({}) },
  });
}

const testFiles: UploadedFile[] = [
  { filename: 'more-books.jpg', mimetype: 'image/jpeg', data: Buffer.from('image-data') },
];

describe('addImages handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(addImagesToRequest).mockResolvedValue([2]);
    vi.mocked(extractAndStoreBooksPerImage).mockResolvedValue(undefined);
  });

  it('should return 400 when no files provided', async () => {
    const result = await addImages(mockContext(), 'request-id', []);

    expect(result).toEqual({ status: 400, body: { error: 'No files uploaded', success: false } });
    expect(addImagesToRequest).not.toHaveBeenCalled();
  });

  it('should store the new images and extract books for only the new images', async () => {
    const result = await addImages(mockContext(), 'request-id', testFiles);

    expect(addImagesToRequest).toHaveBeenCalledWith({}, 'request-id', testFiles);
    expect(extractAndStoreBooksPerImage).toHaveBeenCalledWith(
      {},
      testFiles,
      [2],
      expect.objectContaining({ getClient: expect.any(Function) })
    );
    expect(result).toEqual({ status: 200, body: { imagesAdded: 1, success: true } });
  });
});
