import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecentRecommendations } from './get-recent-recommendations.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');
import {
  findRecentRecommendationsForRequest,
  findRequestById,
} from '../../queries/recommendations.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

describe('getRecentRecommendations handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 when the request does not exist', async () => {
    vi.mocked(findRequestById).mockResolvedValue(null);

    const result = await getRecentRecommendations(mockContext(), 'non-existent-id');

    expect(result).toEqual({ status: 404, body: { error: 'Request not found', success: false } });
    expect(findRecentRecommendationsForRequest).not.toHaveBeenCalled();
  });

  it('should return recent recommendations newest first, with ISO timestamps', async () => {
    vi.mocked(findRequestById).mockResolvedValue({ id: 'request-id', email: null });
    vi.mocked(findRecentRecommendationsForRequest).mockResolvedValue([
      {
        id: 'rec-2',
        createdUtc: new Date('2024-02-01T00:00:00.000Z'),
        processedUtc: new Date('2024-02-01T00:05:00.000Z'),
      },
      {
        id: 'rec-1',
        createdUtc: new Date('2024-01-01T00:00:00.000Z'),
        processedUtc: null,
      },
    ]);

    const result = await getRecentRecommendations(mockContext(), 'request-id');

    expect(findRecentRecommendationsForRequest).toHaveBeenCalledWith({}, 'request-id', 5);
    expect(result).toEqual({
      status: 200,
      body: {
        recommendations: [
          {
            id: 'rec-2',
            createdUtc: '2024-02-01T00:00:00.000Z',
            processedUtc: '2024-02-01T00:05:00.000Z',
          },
          { id: 'rec-1', createdUtc: '2024-01-01T00:00:00.000Z', processedUtc: null },
        ],
        success: true,
      },
    });
  });

  it('should return an empty list when the request has no recommendations', async () => {
    vi.mocked(findRequestById).mockResolvedValue({ id: 'request-id', email: null });
    vi.mocked(findRecentRecommendationsForRequest).mockResolvedValue([]);

    const result = await getRecentRecommendations(mockContext(), 'request-id');

    expect(result).toEqual({ status: 200, body: { recommendations: [], success: true } });
  });
});
