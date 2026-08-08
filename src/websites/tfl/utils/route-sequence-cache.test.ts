import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedRouteSequence, clearRouteSequenceCache } from './route-sequence-cache.js';
import type { TflRouteSequence } from './tfl-api.js';

vi.mock('./tfl-api.js');

import { getRouteSequence } from './tfl-api.js';

const routeSequence: TflRouteSequence = {
  stopPointSequences: [],
  orderedLineRoutes: [],
};

const mockClient = {} as never;

describe('getCachedRouteSequence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    clearRouteSequenceCache();
  });

  it('only fetches once for repeated calls with the same line and direction', async () => {
    vi.mocked(getRouteSequence).mockResolvedValue(routeSequence);

    await getCachedRouteSequence(mockClient, 'district', 'inbound');
    await getCachedRouteSequence(mockClient, 'district', 'inbound');
    await getCachedRouteSequence(mockClient, 'district', 'inbound');

    expect(getRouteSequence).toHaveBeenCalledTimes(1);
  });

  it('fetches separately for different lines or directions', async () => {
    vi.mocked(getRouteSequence).mockResolvedValue(routeSequence);

    await getCachedRouteSequence(mockClient, 'district', 'inbound');
    await getCachedRouteSequence(mockClient, 'district', 'outbound');
    await getCachedRouteSequence(mockClient, 'victoria', 'inbound');

    expect(getRouteSequence).toHaveBeenCalledTimes(3);
  });

  it('refetches once the cached entry expires', async () => {
    vi.useFakeTimers();
    vi.mocked(getRouteSequence).mockResolvedValue(routeSequence);

    await getCachedRouteSequence(mockClient, 'district', 'inbound');
    vi.advanceTimersByTime(25 * 60 * 60 * 1000); // just past the 24h TTL
    await getCachedRouteSequence(mockClient, 'district', 'inbound');

    expect(getRouteSequence).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed fetch, so the next call retries', async () => {
    vi.mocked(getRouteSequence).mockRejectedValueOnce(new Error('TfL is down'));
    vi.mocked(getRouteSequence).mockResolvedValueOnce(routeSequence);

    await expect(getCachedRouteSequence(mockClient, 'district', 'inbound')).rejects.toThrow(
      'TfL is down'
    );
    const result = await getCachedRouteSequence(mockClient, 'district', 'inbound');

    expect(result).toBe(routeSequence);
    expect(getRouteSequence).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent calls into a single fetch', async () => {
    let resolveFetch!: (_result: TflRouteSequence) => void;
    vi.mocked(getRouteSequence).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const first = getCachedRouteSequence(mockClient, 'district', 'inbound');
    const second = getCachedRouteSequence(mockClient, 'district', 'inbound');

    resolveFetch(routeSequence);
    await Promise.all([first, second]);

    expect(getRouteSequence).toHaveBeenCalledTimes(1);
  });
});
