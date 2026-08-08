import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { TflClientWrapper } from '@core/utils/tfl-client.js';

// Verifies destinationName's Zod schema actually normalizes real HTTP query strings correctly —
// Hono collapses a single query value to a plain string and only produces an array when the same
// key is repeated, so the handler-level tests (which pass already-parsed TS values) can't catch a
// mistake here on their own.

vi.mock('../../utils/tfl-api.js');

import { getStopPointArrivals } from '../../utils/tfl-api.js';

const mockTflClient = { getClient: () => ({}) } as unknown as TflClientWrapper;

interface ArrivalsResponseBody {
  arrivals: { destinationName: string }[];
}

describe('GET /tfl/arrivals query parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStopPointArrivals).mockResolvedValue([
      {
        lineId: 'district',
        lineName: 'District',
        platformName: 'Westbound - Platform 1',
        direction: 'outbound',
        destinationName: 'Wimbledon',
        timeToStation: 60,
        expectedArrival: '2026-08-08T09:01:00Z',
        currentLocation: 'Approaching',
      },
      {
        lineId: 'district',
        lineName: 'District',
        platformName: 'Westbound - Platform 1',
        direction: 'outbound',
        destinationName: 'Richmond',
        timeToStation: 90,
        expectedArrival: '2026-08-08T09:01:30Z',
        currentLocation: 'At Gloucester Road',
      },
      {
        lineId: 'district',
        lineName: 'District',
        platformName: 'Westbound - Platform 1',
        direction: 'outbound',
        destinationName: 'Ealing Broadway',
        timeToStation: 120,
        expectedArrival: '2026-08-08T09:02:00Z',
        currentLocation: 'At South Kensington',
      },
    ]);
  });

  it('accepts a single destinationName value', async () => {
    const app = await createTestApp({ tflClient: mockTflClient });

    const response = await app.request(
      '/tfl/arrivals?stopPointId=940GZZLUECT&destinationName=Wimbledon'
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ArrivalsResponseBody;
    expect(body.arrivals.map((a) => a.destinationName)).toEqual(['Wimbledon']);
  });

  it('accepts multiple repeated destinationName values', async () => {
    const app = await createTestApp({ tflClient: mockTflClient });

    const response = await app.request(
      '/tfl/arrivals?stopPointId=940GZZLUECT&destinationName=Wimbledon&destinationName=Richmond'
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ArrivalsResponseBody;
    expect(body.arrivals.map((a) => a.destinationName).sort()).toEqual(['Richmond', 'Wimbledon']);
  });

  it('returns everything when destinationName is omitted', async () => {
    const app = await createTestApp({ tflClient: mockTflClient });

    const response = await app.request('/tfl/arrivals?stopPointId=940GZZLUECT');

    expect(response.status).toBe(200);
    const body = (await response.json()) as ArrivalsResponseBody;
    expect(body.arrivals).toHaveLength(3);
  });
});
