import { describe, it, expect, vi } from 'vitest';
import { getLineArrivals } from './tfl-api.js';
import type { TflArrival } from './tfl-api.js';

function mockClient(arrivals: TflArrival[]) {
  return { get: vi.fn().mockResolvedValue({ data: arrivals }) } as never;
}

describe('getLineArrivals', () => {
  it('requests arrivals scoped to the given line and stop point', async () => {
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
    ];
    const client = mockClient(arrivals);

    const result = await getLineArrivals(client, 'district', '940GZZLUECT');

    expect(result).toEqual(arrivals);
    expect((client as { get: ReturnType<typeof vi.fn> }).get).toHaveBeenCalledWith(
      '/Line/district/Arrivals/940GZZLUECT'
    );
  });

  it('returns an empty list when there are no arrivals', async () => {
    const result = await getLineArrivals(mockClient([]), 'district', '940GZZLUECT');
    expect(result).toEqual([]);
  });

  it('falls back to "Check front of train" when TfL omits destinationName', async () => {
    // TfL drops the field entirely (not an empty string) for trains it can't yet assign a
    // destination to, e.g. reversing District line trains near Earl's Court.
    const arrivalWithoutDestination = {
      lineId: 'district',
      lineName: 'District',
      platformName: 'Eastbound - Platform 2',
      timeToStation: 300,
      expectedArrival: '2026-08-08T09:01:00Z',
      currentLocation: 'Approaching Fulham Broadway Platform 2',
      modeName: 'tube',
    } as unknown as TflArrival;
    const client = mockClient([arrivalWithoutDestination]);

    const result = await getLineArrivals(client, 'district', '940GZZLUECT');

    expect(result[0].destinationName).toBe('Check front of train');
  });
});
