import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBranches } from './get-branches.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { TflRouteSequence } from '../../utils/tfl-api.js';
import { clearRouteSequenceCache } from '../../utils/route-sequence-cache.js';

vi.mock('../../utils/tfl-api.js');

import { getRouteSequence } from '../../utils/tfl-api.js';

function mockContext() {
  return createMockContext<Context>({
    tflClient: { getClient: () => ({}) },
  });
}

const routeSequence: TflRouteSequence = {
  stopPointSequences: [
    {
      stopPoint: [
        { id: 'earls-court', name: "Earl's Court" },
        { id: 'west-brompton', name: 'West Brompton' },
        { id: 'parsons-green', name: 'Parsons Green' },
        { id: 'wimbledon', name: 'Wimbledon' },
      ],
    },
  ],
  orderedLineRoutes: [
    {
      name: 'Upminster <-> Wimbledon',
      naptanIds: ['earls-court', 'west-brompton', 'parsons-green', 'wimbledon'],
    },
  ],
};

describe('getBranches handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRouteSequenceCache();
  });

  it('derives branches downstream of the given stop', async () => {
    vi.mocked(getRouteSequence).mockResolvedValue(routeSequence);

    const result = await getBranches(mockContext(), {
      stopPointId: 'earls-court',
      lineId: 'district',
      direction: 'inbound',
    });

    expect(result).toEqual({
      branches: [
        {
          terminus: 'Wimbledon',
          destinations: ['West Brompton', 'Parsons Green', 'Wimbledon'],
          label: 'Wimbledon',
        },
      ],
    });
    expect(getRouteSequence).toHaveBeenCalledWith(expect.anything(), 'district', 'inbound');
  });

  it('returns no branches for a stop with nothing downstream', async () => {
    vi.mocked(getRouteSequence).mockResolvedValue(routeSequence);

    const result = await getBranches(mockContext(), {
      stopPointId: 'wimbledon',
      lineId: 'district',
      direction: 'inbound',
    });

    expect(result).toEqual({ branches: [] });
  });
});
