import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getArrivals } from './get-arrivals.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { TflArrival } from '../../utils/tfl-api.js';

vi.mock('../../utils/tfl-api.js');

import { getStopPointArrivals } from '../../utils/tfl-api.js';

function mockContext() {
  return createMockContext<Context>({
    tflClient: { getClient: () => ({}) },
  });
}

const arrivals: TflArrival[] = [
  {
    lineId: 'victoria',
    lineName: 'Victoria',
    platformName: 'Southbound - Platform 1',
    direction: 'outbound',
    destinationName: 'Brixton',
    timeToStation: 300,
    expectedArrival: '2026-08-08T09:05:00Z',
  },
  {
    lineId: 'victoria',
    lineName: 'Victoria',
    platformName: 'Southbound - Platform 1',
    direction: 'outbound',
    destinationName: 'Brixton',
    timeToStation: 60,
    expectedArrival: '2026-08-08T09:01:00Z',
  },
  {
    lineId: 'victoria',
    lineName: 'Victoria',
    platformName: 'Northbound - Platform 2',
    direction: 'inbound',
    destinationName: 'Walthamstow Central',
    timeToStation: 120,
    expectedArrival: '2026-08-08T09:02:00Z',
  },
  {
    lineId: 'jubilee',
    lineName: 'Jubilee',
    platformName: 'Westbound - Platform 3',
    direction: 'outbound',
    destinationName: 'Stanmore',
    timeToStation: 30,
    expectedArrival: '2026-08-08T09:00:30Z',
  },
];

describe('getArrivals handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return arrivals sorted by soonest, capped at the limit', async () => {
    vi.mocked(getStopPointArrivals).mockResolvedValue(arrivals);

    const result = await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      limit: 3,
    });

    expect(result.arrivals).toHaveLength(3);
    expect(result.arrivals.map((a) => a.timeToStationSeconds)).toEqual([30, 60, 120]);
  });

  it('should filter by line and direction', async () => {
    vi.mocked(getStopPointArrivals).mockResolvedValue(arrivals);

    const result = await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      lineId: 'victoria',
      direction: 'outbound',
      limit: 3,
    });

    expect(result.arrivals).toEqual([
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        platformName: 'Southbound - Platform 1',
        direction: 'outbound',
        destinationName: 'Brixton',
        timeToStationSeconds: 60,
        expectedArrival: '2026-08-08T09:01:00Z',
      },
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        platformName: 'Southbound - Platform 1',
        direction: 'outbound',
        destinationName: 'Brixton',
        timeToStationSeconds: 300,
        expectedArrival: '2026-08-08T09:05:00Z',
      },
    ]);
  });

  it('should return an empty list when there are no arrivals', async () => {
    vi.mocked(getStopPointArrivals).mockResolvedValue([]);

    const result = await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      limit: 3,
    });

    expect(result).toEqual({ arrivals: [] });
  });
});
