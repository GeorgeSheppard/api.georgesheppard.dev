import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProfile } from './get-profile.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');
import { findProfileByRequestId } from '../../queries/recommendations.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

describe('getProfile handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 when request does not exist', async () => {
    vi.mocked(findProfileByRequestId).mockResolvedValue(null);

    const result = await getProfile(mockContext(), 'non-existent-id');

    expect(result).toEqual({ status: 404, body: { error: 'Request not found', success: false } });
  });

  it('should return profile images (with per-image books) and preferences', async () => {
    const processedUtc = new Date('2024-01-01T00:00:00.000Z');
    vi.mocked(findProfileByRequestId).mockResolvedValue({
      requestId: 'request-id',
      customPreferences: 'More sci-fi please',
      images: [
        {
          id: 1,
          contentType: 'image/jpeg',
          accessToken: 'token-1',
          extractedBooks: [{ title: 'Dune', author: 'Frank Herbert' }],
          processedUtc,
        },
      ],
    });

    const result = await getProfile(mockContext(), 'request-id');

    expect(result).toEqual({
      status: 200,
      body: {
        images: [
          {
            id: 1,
            contentType: 'image/jpeg',
            accessToken: 'token-1',
            extractedBooks: [{ title: 'Dune', author: 'Frank Herbert' }],
            processedUtc: processedUtc.toISOString(),
          },
        ],
        customPreferences: 'More sci-fi please',
        success: true,
      },
    });
  });

  it('should return null extractedBooks/processedUtc for an unprocessed image', async () => {
    vi.mocked(findProfileByRequestId).mockResolvedValue({
      requestId: 'request-id',
      customPreferences: null,
      images: [
        {
          id: 1,
          contentType: 'image/jpeg',
          accessToken: 'token-1',
          extractedBooks: null,
          processedUtc: null,
        },
      ],
    });

    const result = await getProfile(mockContext(), 'request-id');

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.images).toEqual([
        {
          id: 1,
          contentType: 'image/jpeg',
          accessToken: 'token-1',
          extractedBooks: null,
          processedUtc: null,
        },
      ]);
    }
  });

  it('should return null customPreferences when unset', async () => {
    vi.mocked(findProfileByRequestId).mockResolvedValue({
      requestId: 'request-id',
      customPreferences: null,
      images: [],
    });

    const result = await getProfile(mockContext(), 'request-id');

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.customPreferences).toBeNull();
      expect(result.body.images).toEqual([]);
    }
  });
});
