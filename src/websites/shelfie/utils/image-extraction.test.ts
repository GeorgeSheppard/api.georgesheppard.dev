import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractAndStoreBooksForRequest } from './image-extraction.js';

vi.mock('../queries/recommendations.js');
vi.mock('@core/utils/openai-book-extractor.js');
vi.mock('@core/utils/heic-converter.js');

import {
  findUnprocessedImagesForRequest,
  setImageExtractedBooks,
} from '../queries/recommendations.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';
import { convertHeicToJpeg, isHeicFile } from '@core/utils/heic-converter.js';

const openaiClient = { getClient: () => ({}) } as never;

describe('extractAndStoreBooksForRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isHeicFile).mockReturnValue(false);
    vi.mocked(extractBooksFromImages).mockResolvedValue([{ title: 'Dune', author: null }]);
  });

  it('does nothing when there are no unprocessed images', async () => {
    vi.mocked(findUnprocessedImagesForRequest).mockResolvedValue([]);

    await extractAndStoreBooksForRequest({} as never, 'request-id', openaiClient);

    expect(extractBooksFromImages).not.toHaveBeenCalled();
    expect(setImageExtractedBooks).not.toHaveBeenCalled();
  });

  it('extracts and stores books for each unprocessed image', async () => {
    vi.mocked(findUnprocessedImagesForRequest).mockResolvedValue([
      { id: 1, requestId: 'request-id', image: Buffer.from('a'), contentType: 'image/jpeg' },
      { id: 2, requestId: 'request-id', image: Buffer.from('b'), contentType: 'image/png' },
    ]);

    await extractAndStoreBooksForRequest({} as never, 'request-id', openaiClient);

    expect(extractBooksFromImages).toHaveBeenCalledTimes(2);
    expect(setImageExtractedBooks).toHaveBeenCalledWith({}, 1, [{ title: 'Dune', author: null }]);
    expect(setImageExtractedBooks).toHaveBeenCalledWith({}, 2, [{ title: 'Dune', author: null }]);
  });

  it('converts HEIC images before extraction', async () => {
    vi.mocked(findUnprocessedImagesForRequest).mockResolvedValue([
      {
        id: 1,
        requestId: 'request-id',
        image: Buffer.from('heic-data'),
        contentType: 'image/heic',
      },
    ]);
    vi.mocked(isHeicFile).mockReturnValue(true);
    vi.mocked(convertHeicToJpeg).mockResolvedValue(Buffer.from('jpeg-data'));

    await extractAndStoreBooksForRequest({} as never, 'request-id', openaiClient);

    expect(convertHeicToJpeg).toHaveBeenCalledWith(Buffer.from('heic-data'));
    expect(extractBooksFromImages).toHaveBeenCalledWith(
      [{ buffer: Buffer.from('jpeg-data'), contentType: 'image/jpeg' }],
      expect.anything()
    );
  });

  it('logs and skips an image whose extraction fails, without throwing', async () => {
    vi.mocked(findUnprocessedImagesForRequest).mockResolvedValue([
      { id: 1, requestId: 'request-id', image: Buffer.from('a'), contentType: 'image/jpeg' },
      { id: 2, requestId: 'request-id', image: Buffer.from('b'), contentType: 'image/jpeg' },
    ]);
    vi.mocked(extractBooksFromImages)
      .mockRejectedValueOnce(new Error('OpenAI request failed'))
      .mockResolvedValueOnce([{ title: 'Dune', author: null }]);

    await expect(
      extractAndStoreBooksForRequest({} as never, 'request-id', openaiClient)
    ).resolves.toBeUndefined();

    expect(setImageExtractedBooks).toHaveBeenCalledTimes(1);
    expect(setImageExtractedBooks).toHaveBeenCalledWith({}, 2, [{ title: 'Dune', author: null }]);
  });
});
