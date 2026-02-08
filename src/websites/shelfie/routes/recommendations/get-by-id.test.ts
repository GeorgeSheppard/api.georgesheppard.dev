import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getById } from './get-by-id.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Recommendation } from '@core/types/recommendation.js';

vi.mock('../../queries/recommendations.js');
import { findRecommendationWithRequest } from '../../queries/recommendations.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

const testRecommendations: Recommendation[] = [
  {
    name: 'The Midnight Library',
    author: 'Matt Haig',
    description: 'A novel about infinite possibilities',
    reason: 'Based on your interest in philosophical fiction',
    amazonLink: 'https://amazon.com/midnight-library',
  },
];

describe('getById handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('not found', () => {
    it('should return 404 when recommendation does not exist', async () => {
      vi.mocked(findRecommendationWithRequest).mockResolvedValue(null);

      const result = await getById(mockContext(), 'non-existent-id');

      expect(result).toEqual({
        status: 404,
        body: { error: 'Recommendation not found', success: false },
      });
    });
  });

  describe('unprocessable (422)', () => {
    it('should return 422 when processed but recommendations are null', async () => {
      vi.mocked(findRecommendationWithRequest).mockResolvedValue({
        recommendations: null,
        processedUtc: new Date(),
        email: null,
        frequency: null,
      });

      const result = await getById(mockContext(), 'some-id');

      expect(result.status).toBe(422);
      expect(result.body).toEqual({
        error:
          "We couldn't create any recommendations for you. Please make sure your bookshelf is readable.",
        success: false,
      });
    });

    it('should return 422 when processed but recommendations are empty', async () => {
      vi.mocked(findRecommendationWithRequest).mockResolvedValue({
        recommendations: [],
        processedUtc: new Date(),
        email: null,
        frequency: null,
      });

      const result = await getById(mockContext(), 'some-id');

      expect(result.status).toBe(422);
    });
  });

  describe('success (200)', () => {
    it('should return recommendations with metadata', async () => {
      vi.mocked(findRecommendationWithRequest).mockResolvedValue({
        recommendations: testRecommendations,
        processedUtc: new Date(),
        email: 'encrypted-email',
        frequency: 'M',
      });

      const result = await getById(mockContext(), 'some-id');

      expect(result).toEqual({
        status: 200,
        body: {
          recommendations: testRecommendations,
          hasEmail: true,
          isRecurringMonthly: true,
          success: true,
        },
      });
    });

    it('should return hasEmail false when no email', async () => {
      vi.mocked(findRecommendationWithRequest).mockResolvedValue({
        recommendations: testRecommendations,
        processedUtc: new Date(),
        email: null,
        frequency: null,
      });

      const result = await getById(mockContext(), 'some-id');

      expect(result.status).toBe(200);
      if (result.status === 200) {
        expect(result.body.hasEmail).toBe(false);
        expect(result.body.isRecurringMonthly).toBe(false);
      }
    });

    it('should return null recommendations when not yet processed', async () => {
      vi.mocked(findRecommendationWithRequest).mockResolvedValue({
        recommendations: null,
        processedUtc: null,
        email: null,
        frequency: null,
      });

      const result = await getById(mockContext(), 'some-id');

      expect(result.status).toBe(200);
      if (result.status === 200) {
        expect(result.body.recommendations).toBeNull();
      }
    });

    it('should pass db and id to the query function', async () => {
      const mockDb = { select: 'mock' };
      const c = createMockContext({ databaseClient: { db: mockDb } });
      vi.mocked(findRecommendationWithRequest).mockResolvedValue(null);

      await getById(c, 'test-uuid');

      expect(findRecommendationWithRequest).toHaveBeenCalledWith(mockDb, 'test-uuid');
    });
  });
});
