import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fromBookcase } from './from-bookcase.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { UploadedFile } from '@core/utils/multipart.js';

vi.mock('../../queries/recommendations.js');

import { createBookcaseRequest } from '../../queries/recommendations.js';

const mockSendToQueue = vi.fn();
const mockGetLocation = vi.fn();

function mockContext() {
  return createMockContext({
    databaseClient: { db: {} },
    ipLocator: { getLocation: mockGetLocation },
    queueClient: {
      channel: { sendToQueue: mockSendToQueue },
      recommendationQueue: 'recommendations',
    },
  });
}

const testFiles: UploadedFile[] = [
  { filename: 'bookcase.jpg', mimetype: 'image/jpeg', data: Buffer.from('image-data') },
];

describe('fromBookcase handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocation.mockResolvedValue({ toString: () => 'London, UK' });
    vi.mocked(createBookcaseRequest).mockResolvedValue({
      newRequest: { id: 'req-1' },
      recommendation: { id: 'rec-1' },
    });
  });

  describe('bad request (400)', () => {
    it('should return 400 when no files provided', async () => {
      const result = await fromBookcase(mockContext(), [], undefined);

      expect(result).toEqual({
        status: 400,
        body: { error: 'No files uploaded', success: false },
      });
    });
  });

  describe('success (200)', () => {
    it('should create bookcase request and queue message', async () => {
      const result = await fromBookcase(mockContext(), testFiles, '1.2.3.4');

      expect(result).toEqual({
        status: 200,
        body: { id: 'rec-1', success: true },
      });
      expect(createBookcaseRequest).toHaveBeenCalledWith({}, 'London, UK', testFiles);
      expect(mockSendToQueue).toHaveBeenCalledWith('recommendations', expect.any(Buffer), {
        persistent: true,
      });
    });

    it('should pass forwarded-for header to ip locator', async () => {
      await fromBookcase(mockContext(), testFiles, '10.0.0.1');

      expect(mockGetLocation).toHaveBeenCalledWith('10.0.0.1');
    });

    it('should pass undefined forwarded-for when not present', async () => {
      await fromBookcase(mockContext(), testFiles, undefined);

      expect(mockGetLocation).toHaveBeenCalledWith(undefined);
    });
  });

  describe('queue failure (500)', () => {
    it('should return 500 when queue message fails', async () => {
      mockSendToQueue.mockImplementation(() => {
        throw new Error('RabbitMQ connection lost');
      });

      const result = await fromBookcase(mockContext(), testFiles, undefined);

      expect(result).toEqual({
        status: 500,
        body: { error: 'Failed to queue recommendation processing', success: false },
      });
    });
  });
});
