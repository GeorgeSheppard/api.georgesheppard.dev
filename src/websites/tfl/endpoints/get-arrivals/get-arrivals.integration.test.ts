import { describe, it, expect } from 'vitest';
import { createTestApp } from '@test/utils/app.js';
import { createMockTflClient } from '@test/mocks/tfl-client.js';
import type { GetArrivalsResponse } from './get-arrivals.js';

const EARLS_COURT = '940GZZLUECT';

describe('GET /tfl/arrivals', () => {
  it('requests arrivals for the given line and stop point, and returns them sorted and capped', async () => {
    const { tflClient, get } = createMockTflClient({
      [`/Line/district/Arrivals/${EARLS_COURT}`]: [
        {
          lineId: 'district',
          lineName: 'District',
          platformName: 'Westbound - Platform 4',
          direction: 'inbound',
          destinationName: 'Wimbledon Underground Station',
          timeToStation: 300,
          expectedArrival: '2026-08-16T09:05:00Z',
          currentLocation: 'At Gloucester Road',
          modeName: 'tube',
        },
        {
          lineId: 'district',
          lineName: 'District',
          platformName: 'Eastbound - Platform 2',
          direction: 'outbound',
          destinationName: 'Upminster Underground Station',
          timeToStation: 60,
          expectedArrival: '2026-08-16T09:01:00Z',
          currentLocation: 'At Platform',
          modeName: 'tube',
        },
        {
          lineId: 'district',
          lineName: 'District',
          platformName: 'Westbound - Platform 4',
          direction: 'inbound',
          destinationName: 'Richmond Underground Station',
          timeToStation: 120,
          expectedArrival: '2026-08-16T09:02:00Z',
          currentLocation: 'At Earl’s Court',
          modeName: 'tube',
        },
      ],
    });
    const app = await createTestApp({ tflClient });

    const response = await app.request(
      `http://localhost/tfl/arrivals?stopPointId=${EARLS_COURT}&lineId=district&limit=2`
    );

    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledWith(`/Line/district/Arrivals/${EARLS_COURT}`);
    expect(await response.json()).toEqual({
      arrivals: [
        {
          lineId: 'district',
          lineName: 'District',
          platformName: 'Eastbound - Platform 2',
          direction: 'outbound',
          destinationName: 'Upminster Underground Station',
          timeToStationSeconds: 60,
          expectedArrival: '2026-08-16T09:01:00Z',
          currentLocation: 'At Platform',
        },
        {
          lineId: 'district',
          lineName: 'District',
          platformName: 'Westbound - Platform 4',
          direction: 'inbound',
          destinationName: 'Richmond Underground Station',
          timeToStationSeconds: 120,
          expectedArrival: '2026-08-16T09:02:00Z',
          currentLocation: 'At Earl’s Court',
        },
      ],
    });
  });

  it('falls back to "Check front of train" when TfL omits destinationName', async () => {
    // Reproduces the real Earl's Court response: District line trains near a reversing/branching
    // point are sometimes reported without a confirmed destination at all.
    const { tflClient } = createMockTflClient({
      [`/Line/district/Arrivals/${EARLS_COURT}`]: [
        {
          lineId: 'district',
          lineName: 'District',
          platformName: 'Eastbound - Platform 2',
          timeToStation: 300,
          expectedArrival: '2026-08-16T09:05:00Z',
          currentLocation: 'Approaching Fulham Broadway Platform 2',
          modeName: 'tube',
        },
      ],
    });
    const app = await createTestApp({ tflClient });

    const response = await app.request(
      `http://localhost/tfl/arrivals?stopPointId=${EARLS_COURT}&lineId=district`
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as GetArrivalsResponse;
    expect(body.arrivals[0].destinationName).toBe('Check front of train');
  });

  it('returns an empty list when TfL has no arrivals for the line', async () => {
    const { tflClient } = createMockTflClient({
      [`/Line/district/Arrivals/${EARLS_COURT}`]: [],
    });
    const app = await createTestApp({ tflClient });

    const response = await app.request(
      `http://localhost/tfl/arrivals?stopPointId=${EARLS_COURT}&lineId=district`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ arrivals: [] });
  });

  it('returns 400 when stopPointId is missing', async () => {
    const { tflClient } = createMockTflClient();
    const app = await createTestApp({ tflClient });

    const response = await app.request('http://localhost/tfl/arrivals?lineId=district');

    expect(response.status).toBe(400);
  });

  it('returns 400 when lineId is missing', async () => {
    const { tflClient } = createMockTflClient();
    const app = await createTestApp({ tflClient });

    const response = await app.request(`http://localhost/tfl/arrivals?stopPointId=${EARLS_COURT}`);

    expect(response.status).toBe(400);
  });

  it('returns 400 when limit exceeds the maximum', async () => {
    const { tflClient } = createMockTflClient();
    const app = await createTestApp({ tflClient });

    const response = await app.request(
      `http://localhost/tfl/arrivals?stopPointId=${EARLS_COURT}&lineId=district&limit=51`
    );

    expect(response.status).toBe(400);
  });
});
