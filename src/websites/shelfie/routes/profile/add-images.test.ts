import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addImages } from './add-images.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { UploadedFile } from '@core/utils/multipart.js';

vi.mock('../../queries/recommendations.js');
vi.mock('../../utils/image-extraction.js');

import {
  addImagesToRequest,
  createRecommendationForRequest,
} from '../../queries/recommendations.js';
import { extractAndStoreBooksPerImage } from '../../utils/image-extraction.js';

const mockSendToQueue = vi.fn();

function mockContext() {
  return createMockContext({
    databaseClient: { db: {} },
    openaiClient: { getClient: () => ({}) },
    queueClient: {
      channel: { sendToQueue: mockSendToQueue },
      recommendationQueue: 'recommendations',
    },
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
    vi.mocked(createRecommendationForRequest).mockResolvedValue({ id: 'rec-2' });
  });

  it('should return 400 when no files provided', async () => {
    const result = await addImages(mockContext(), 'request-id', []);

    expect(result).toEqual({ status: 400, body: { error: 'No files uploaded', success: false } });
    expect(addImagesToRequest).not.toHaveBeenCalled();
  });

  it('should store the new images, extract books for only the new images, and queue regeneration', async () => {
    const result = await addImages(mockContext(), 'request-id', testFiles);

    expect(addImagesToRequest).toHaveBeenCalledWith({}, 'request-id', testFiles);
    expect(extractAndStoreBooksPerImage).toHaveBeenCalledWith(
      {},
      testFiles,
      [2],
      expect.objectContaining({ getClient: expect.any(Function) })
    );
    expect(createRecommendationForRequest).toHaveBeenCalledWith({}, 'request-id');
    expect(mockSendToQueue).toHaveBeenCalledWith('recommendations', expect.any(Buffer), {
      persistent: true,
    });
    const sentBuffer = mockSendToQueue.mock.calls[0][1];
    expect(JSON.parse(sentBuffer.toString())).toEqual({
      userId: 'request-id',
      recommendationId: 'rec-2',
    });
    expect(result).toEqual({
      status: 200,
      body: { imagesAdded: 1, recommendationId: 'rec-2', success: true },
    });
  });

  it('should return 500 when queueing regeneration fails', async () => {
    mockSendToQueue.mockImplementation(() => {
      throw new Error('RabbitMQ connection lost');
    });

    const result = await addImages(mockContext(), 'request-id', testFiles);

    expect(result).toEqual({
      status: 500,
      body: { error: 'Failed to queue recommendation processing', success: false },
    });
  });
});
