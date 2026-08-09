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
  {
    lineId: 'jubilee',
    lineName: 'Jubilee',
    platformName: 'Westbound - Platform 3',
    direction: 'outbound',
    destinationName: 'Stanmore',
    timeToStation: 30,
    expectedArrival: '2026-08-08T09:00:30Z',
    currentLocation: 'At Platform',
    modeName: 'tube',
  },
  {
    lineId: 'district',
    lineName: 'District',
    platformName: 'Westbound - Platform 1',
    direction: 'outbound',
    destinationName: 'Wimbledon',
    timeToStation: 200,
    expectedArrival: '2026-08-08T09:03:20Z',
    currentLocation: 'At Gloucester Road',
    modeName: 'tube',
  },
  {
    lineId: 'district',
    lineName: 'District',
    platformName: 'Westbound - Platform 1',
    direction: 'outbound',
    destinationName: 'Richmond',
    timeToStation: 90,
    expectedArrival: '2026-08-08T09:01:30Z',
    currentLocation: 'At Kensington (Olympia)',
    modeName: 'tube',
  },
];

describe('getArrivals handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return arrivals sorted by soonest, capped at the limit', async () => {
    vi.mocked(getStopPointArrivals).mockResolvedValue(arrivals);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T09:00:00Z'));

    const result = await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      limit: 3,
    });

    expect(result.arrivals).toHaveLength(3);
    expect(result.arrivals.map((a) => a.timeToStationSeconds)).toEqual([30, 60, 90]);
    vi.useRealTimers();
  });

  it('should filter by line and direction', async () => {
    vi.mocked(getStopPointArrivals).mockResolvedValue(arrivals);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T09:00:00Z'));

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
        currentLocation: 'Approaching',
      },
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        platformName: 'Southbound - Platform 1',
        direction: 'outbound',
        destinationName: 'Brixton',
        timeToStationSeconds: 300,
        expectedArrival: '2026-08-08T09:05:00Z',
        currentLocation: 'At Kings Cross St Pancras',
      },
    ]);
    vi.useRealTimers();
  });

  it('should return an empty list when there are no arrivals', async () => {
    vi.mocked(getStopPointArrivals).mockResolvedValue([]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T09:00:00Z'));

    const result = await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      limit: 3,
    });

    expect(result).toEqual({ arrivals: [] });
    vi.useRealTimers();
  });

  it('should recalculate timeToStationSeconds based on expectedArrival, not stale timeToStation from API', async () => {
    const staleArrivals: TflArrival[] = [
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        platformName: 'Southbound - Platform 1',
        direction: 'outbound',
        destinationName: 'Brixton',
        timeToStation: 120, // This was 120 when API responded 30s ago, but train arrives in 90s
        expectedArrival: '2026-08-08T09:01:30Z',
        currentLocation: 'Approaching',
        modeName: 'tube',
      },
    ];
    vi.mocked(getStopPointArrivals).mockResolvedValue(staleArrivals);
    vi.useFakeTimers();
    // Simulate 30 seconds elapsed since the API returned
    vi.setSystemTime(new Date('2026-08-08T09:00:30Z'));

    const result = await getArrivals(mockContext(), {
      stopPointId: '940GZZLUVIC',
      limit: 3,
    });

    // Should show 60 seconds (90 - 30), not the stale 120
    expect(result.arrivals[0].timeToStationSeconds).toBe(60);
    vi.useRealTimers();
  });
});
