import { describe, it, expect, vi } from 'vitest';
import { getLineArrivals, resolveTubeStopPointId } from './tfl-api.js';
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
});

describe('resolveTubeStopPointId', () => {
  it('resolves a HUB id to its tube child StopPoint id', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: {
          id: 'HUBTOM',
          children: [
            { id: '490G000667', modes: ['bus'] },
            { id: '910GTTNHMHL', modes: ['national-rail'] },
            { id: '940GZZLUTMH', modes: ['tube'] },
          ],
        },
      }),
    } as never;

    const result = await resolveTubeStopPointId(client, 'HUBTOM');

    expect(result).toBe('940GZZLUTMH');
  });

  it('returns the id unchanged when it is not a HUB', async () => {
    const client = { get: vi.fn() } as never;

    const result = await resolveTubeStopPointId(client, '940GZZLUECT');

    expect(result).toBe('940GZZLUECT');
    expect((client as { get: ReturnType<typeof vi.fn> }).get).not.toHaveBeenCalled();
  });

  it('returns the HUB id unchanged when no tube child is present', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: { id: 'HUBXYZ', children: [{ id: '490G000667', modes: ['bus'] }] },
      }),
    } as never;

    const result = await resolveTubeStopPointId(client, 'HUBXYZ');

    expect(result).toBe('HUBXYZ');
  });
});
