import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processRecommendationJob } from './recommendation-worker.js';
import { requests, recommendations } from '@core/database/schema/index.js';
import { encryption } from '@core/utils/encryption.js';
import { createMockEmailClient } from '@test/mocks/email.js';
import { createMockRecommender } from '@test/mocks/recommender.js';
import type { DatabaseClient } from '@core/database/client.js';

vi.mock('../queries/recommendations.js');
vi.mock('../utils/image-extraction.js');

import { getExtractedBooksForRequest } from '../queries/recommendations.js';
import { extractAndStoreBooksForRequest } from '../utils/image-extraction.js';

interface FakeUser {
  id: string;
  email: string | null;
  frequency: string | null;
  location: string | null;
  customPreferences: string | null;
}

function createFakeDb(user: FakeUser) {
  const recommendationUpdateSet = vi.fn();
  const requestUpdateSet = vi.fn();

  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === requests) {
          return { where: vi.fn().mockResolvedValue([user]) };
        }
        if (table === recommendations) {
          return {
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([]),
              })),
            })),
          };
        }
        throw new Error('Unexpected table in select');
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: unknown) => {
        if (table === recommendations) {
          recommendationUpdateSet(values);
        } else if (table === requests) {
          requestUpdateSet(values);
        }
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
  };

  return { db, requestUpdateSet };
}

const openaiClient = { getClient: () => ({}) } as never;

describe('processRecommendationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExtractedBooksForRequest).mockResolvedValue([{ title: 'Dune', author: null }]);
    vi.mocked(extractAndStoreBooksForRequest).mockResolvedValue(undefined);
  });

  it('throws when the user is not found', async () => {
    const { db } = createFakeDb(null as never);
    db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) }));

    await expect(
      processRecommendationJob(
        { userId: 'missing-user', recommendationId: 'rec-1' },
        { db } as unknown as DatabaseClient,
        createMockEmailClient(),
        createMockRecommender(),
        openaiClient
      )
    ).rejects.toThrow('User not found: missing-user');
  });

  it('throws when no books have been extracted yet', async () => {
    const { db } = createFakeDb({
      id: 'user-1',
      email: null,
      frequency: null,
      location: null,
      customPreferences: null,
    });
    vi.mocked(getExtractedBooksForRequest).mockResolvedValue([]);

    await expect(
      processRecommendationJob(
        { userId: 'user-1', recommendationId: 'rec-1' },
        { db } as unknown as DatabaseClient,
        createMockEmailClient(),
        createMockRecommender(),
        openaiClient
      )
    ).rejects.toThrow('No processed books found for user: user-1');
  });

  it('sends an email but keeps it stored for a one-time (non-recurring) user', async () => {
    const { db, requestUpdateSet } = createFakeDb({
      id: 'user-1',
      email: encryption.encrypt('reader@example.com'),
      frequency: null,
      location: null,
      customPreferences: null,
    });
    const emailClient = createMockEmailClient();

    await processRecommendationJob(
      { userId: 'user-1', recommendationId: 'rec-1' },
      { db } as unknown as DatabaseClient,
      emailClient,
      createMockRecommender(),
      openaiClient
    );

    expect(emailClient.sendRecommendationsEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['reader@example.com'] })
    );
    // A request can get several ad-hoc recommendations after the first (via the profile page),
    // so the email must not be wiped just because this user never opted into monthly emails.
    expect(requestUpdateSet).not.toHaveBeenCalled();
  });

  it('does not send an email when the user has none', async () => {
    const { db } = createFakeDb({
      id: 'user-1',
      email: null,
      frequency: null,
      location: null,
      customPreferences: null,
    });
    const emailClient = createMockEmailClient();

    await processRecommendationJob(
      { userId: 'user-1', recommendationId: 'rec-1' },
      { db } as unknown as DatabaseClient,
      emailClient,
      createMockRecommender(),
      openaiClient
    );

    expect(emailClient.sendRecommendationsEmail).not.toHaveBeenCalled();
  });
});
