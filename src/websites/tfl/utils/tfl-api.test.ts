import { describe, it, expect, vi } from 'vitest';
import { getStopPointArrivals } from './tfl-api.js';
import type { TflArrival } from './tfl-api.js';

function mockClient(arrivals: TflArrival[]) {
  return { get: vi.fn().mockResolvedValue({ data: arrivals }) } as never;
}

describe('getStopPointArrivals', () => {
  it('filters out non-tube modes, e.g. a multi-modal HUB StopPoint mixing in bus arrivals', async () => {
    const arrivals: TflArrival[] = [
      {
        lineId: 'district',
        lineName: 'District',
        platformName: 'Westbound - Platform 1',
        direction: 'outbound',
        destinationName: 'Wimbledon Underground Station',
        timeToStation: 60,
        expectedArrival: '2026-08-08T09:01:00Z',
        currentLocation: 'Approaching',
        modeName: 'tube',
      },
      {
        lineId: '25',
        lineName: '25',
        platformName: 'Stop A',
        direction: '1',
        destinationName: 'Ilford',
        timeToStation: 90,
        expectedArrival: '2026-08-08T09:01:30Z',
        currentLocation: 'Approaching',
        modeName: 'bus',
      },
    ];

    const result = await getStopPointArrivals(mockClient(arrivals), '940GZZLUECT');

    expect(result).toEqual([arrivals[0]]);
  });

  it('returns an empty list when there are no arrivals', async () => {
    const result = await getStopPointArrivals(mockClient([]), '940GZZLUECT');
    expect(result).toEqual([]);
  });
});
