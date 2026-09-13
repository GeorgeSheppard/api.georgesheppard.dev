import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addImages } from './add-images.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { UploadedFile } from '@core/utils/multipart.js';

vi.mock('../../queries/recommendations.js');
vi.mock('@core/utils/openai-book-extractor.js');

import {
  addImagesToRequest,
  findImagesByRequestId,
  updateBooksProcessed,
} from '../../queries/recommendations.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';

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
    vi.mocked(addImagesToRequest).mockResolvedValue(undefined);
    vi.mocked(findImagesByRequestId).mockResolvedValue([
      { image: Buffer.from('existing'), contentType: 'image/jpeg' },
      { image: Buffer.from('image-data'), contentType: 'image/jpeg' },
    ]);
    vi.mocked(extractBooksFromImages).mockResolvedValue([
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Foundation', author: 'Isaac Asimov' },
    ]);
    vi.mocked(updateBooksProcessed).mockResolvedValue(undefined);
  });

  it('should return 400 when no files provided', async () => {
    const result = await addImages(mockContext(), 'request-id', []);

    expect(result).toEqual({ status: 400, body: { error: 'No files uploaded', success: false } });
    expect(addImagesToRequest).not.toHaveBeenCalled();
  });

  it('should store the new images and re-extract books from all images', async () => {
    const result = await addImages(mockContext(), 'request-id', testFiles);

    expect(addImagesToRequest).toHaveBeenCalledWith({}, 'request-id', testFiles);
    expect(findImagesByRequestId).toHaveBeenCalledWith({}, 'request-id');
    expect(extractBooksFromImages).toHaveBeenCalledWith(
      [
        { buffer: Buffer.from('existing'), contentType: 'image/jpeg' },
        { buffer: Buffer.from('image-data'), contentType: 'image/jpeg' },
      ],
      {}
    );
    expect(updateBooksProcessed).toHaveBeenCalledWith({}, 'request-id', [
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Foundation', author: 'Isaac Asimov' },
    ]);
    expect(result).toEqual({ status: 200, body: { imagesAdded: 1, success: true } });
  });
});
