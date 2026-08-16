import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getArrivals } from './get-arrivals.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { Context } from 'hono';
import type { TflArrival } from '../../utils/tfl-api.js';

vi.mock('../../utils/tfl-api.js');

import { getLineArrivals } from '../../utils/tfl-api.js';

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
    currentLocation: 'At Kings Cross St Pancras',
    modeName: 'tube',
  },
  {
    lineId: 'victoria',
    lineName: 'Victoria',
    platformName: 'Southbound - Platform 1',
    direction: 'outbound',
    destinationName: 'Brixton',
    timeToStation: 60,
    expectedArrival: '2026-08-08T09:01:00Z',
    currentLocation: 'Approaching',
    modeName: 'tube',
  },
  {
    lineId: 'victoria',
    lineName: 'Victoria',
    platformName: 'Northbound - Platform 2',
    direction: 'inbound',
    destinationName: 'Walthamstow Central',
    timeToStation: 120,
    expectedArrival: '2026-08-08T09:02:00Z',
    currentLocation: 'At Green Park',
    modeName: 'tube',
  },
];

describe('getArrivals handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return arrivals sorted by soonest, capped at the limit, keeping both directions', async () => {
    vi.mocked(getLineArrivals).mockResolvedValue(arrivals);

    const result = await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      lineId: 'victoria',
      limit: 2,
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
        currentLocation: 'Approaching',
      },
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        platformName: 'Northbound - Platform 2',
        direction: 'inbound',
        destinationName: 'Walthamstow Central',
        timeToStationSeconds: 120,
        expectedArrival: '2026-08-08T09:02:00Z',
        currentLocation: 'At Green Park',
      },
    ]);
  });

  it('should request arrivals scoped to the requested line and stop point', async () => {
    vi.mocked(getLineArrivals).mockResolvedValue(arrivals);

    await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      lineId: 'victoria',
      limit: 3,
    });

    expect(getLineArrivals).toHaveBeenCalledWith(expect.anything(), 'victoria', '940GZZLUVIC');
  });

  it('should return an empty list when there are no arrivals', async () => {
    vi.mocked(getLineArrivals).mockResolvedValue([]);

    const result = await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      lineId: 'victoria',
      limit: 3,
    });

    expect(result).toEqual({ arrivals: [] });
  });
});
