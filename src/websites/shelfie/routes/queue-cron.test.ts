import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueDueRecommendations } from './queue-cron.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../queries/recommendations.js');

import { findDueUsers, createRecurringRecommendation } from '../queries/recommendations.js';

const mockSendToQueue = vi.fn();

function mockContext() {
  return createMockContext({
    databaseClient: { db: {} },
    queueClient: {
      channel: { sendToQueue: mockSendToQueue },
      recommendationQueue: 'recommendations',
    },
  });
}

describe('queueDueRecommendations handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return zero counts when no due users', async () => {
    vi.mocked(findDueUsers).mockResolvedValue([]);

    const result = await queueDueRecommendations(mockContext());

    expect(result).toEqual({ successCount: 0, totalUsers: 0, queueFailures: 0 });
  });

  it('should process all due users and queue recommendations', async () => {
    vi.mocked(findDueUsers).mockResolvedValue([
      { id: 'user-1', location: 'London', email: 'enc-email-1', booksProcessed: null },
      { id: 'user-2', location: 'Paris', email: 'enc-email-2', booksProcessed: null },
    ]);
    vi.mocked(createRecurringRecommendation)
      .mockResolvedValueOnce({ id: 'rec-1' })
      .mockResolvedValueOnce({ id: 'rec-2' });

    const result = await queueDueRecommendations(mockContext());

    expect(result).toEqual({ successCount: 2, totalUsers: 2, queueFailures: 0 });
    expect(createRecurringRecommendation).toHaveBeenCalledTimes(2);
    expect(mockSendToQueue).toHaveBeenCalledTimes(2);
  });

  it('should count queue failures separately from DB failures', async () => {
    vi.mocked(findDueUsers).mockResolvedValue([
      { id: 'user-1', location: 'London', email: null, booksProcessed: null },
    ]);
    vi.mocked(createRecurringRecommendation).mockResolvedValue({ id: 'rec-1' });
    mockSendToQueue.mockImplementation(() => {
      throw new Error('Queue down');
    });

    const result = await queueDueRecommendations(mockContext());

    expect(result).toEqual({ successCount: 0, totalUsers: 1, queueFailures: 1 });
  });

  it('should continue processing when one user fails at DB level', async () => {
    vi.mocked(findDueUsers).mockResolvedValue([
      { id: 'user-1', location: 'London', email: null, booksProcessed: null },
      { id: 'user-2', location: 'Paris', email: null, booksProcessed: null },
    ]);
    vi.mocked(createRecurringRecommendation)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ id: 'rec-2' });

    const result = await queueDueRecommendations(mockContext());

    expect(result).toEqual({ successCount: 1, totalUsers: 2, queueFailures: 0 });
  });

  it('should send correct queue message format', async () => {
    vi.mocked(findDueUsers).mockResolvedValue([
      { id: 'user-1', location: 'London', email: null, booksProcessed: null },
    ]);
    vi.mocked(createRecurringRecommendation).mockResolvedValue({ id: 'rec-1' });

    await queueDueRecommendations(mockContext());

    const sentBuffer = mockSendToQueue.mock.calls[0][1];
    const parsed = JSON.parse(sentBuffer.toString());
    expect(parsed).toEqual({ userId: 'user-1', recommendationId: 'rec-1' });
    expect(mockSendToQueue).toHaveBeenCalledWith('recommendations', expect.any(Buffer), {
      persistent: true,
    });
  });
});
