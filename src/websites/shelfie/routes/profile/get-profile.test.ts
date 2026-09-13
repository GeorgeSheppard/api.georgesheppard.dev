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

  it('should return profile images and preferences', async () => {
    vi.mocked(findProfileByRequestId).mockResolvedValue({
      requestId: 'request-id',
      customPreferences: 'More sci-fi please',
      images: [{ id: 1, contentType: 'image/jpeg' }],
    });

    const result = await getProfile(mockContext(), 'request-id');

    expect(result).toEqual({
      status: 200,
      body: {
        images: [{ id: 1, contentType: 'image/jpeg' }],
        customPreferences: 'More sci-fi please',
        success: true,
      },
    });
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
